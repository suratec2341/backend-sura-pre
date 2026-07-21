import { Processor, WorkerHost } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { PrismaService, QUEUES } from "@blansole/shared";

interface EventTemplate {
  category: string;
  title: string;
  body: string;
}

interface RuleConfig extends Partial<EventTemplate> {
  field?: string;
  operator?: "eq" | "gte" | "lte";
  value?: string | number | boolean;
}

@Processor(QUEUES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<{ eventId?: string }>): Promise<void> {
    if (job.name === "sweep-events" || !job.data?.eventId) {
      await this.sweepEvents();
      return;
    }
    await this.processEvent(job.data.eventId);
  }

  private async sweepEvents() {
    const events = await this.prisma.notificationEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: { id: true },
    });
    for (const event of events) {
      try {
        await this.processEvent(event.id);
      } catch (error) {
        await this.prisma.notificationEvent.updateMany({
          where: { id: event.id, processedAt: null },
          data: { processingError: this.errorMessage(error).slice(0, 2_000) },
        });
      }
    }
  }

  private async processEvent(eventId: string) {
    const event = await this.prisma.notificationEvent.findUnique({
      where: { id: eventId },
      include: { notification: true },
    });
    if (!event || event.processedAt) return;
    if (event.notification) {
      await this.markProcessed(event.id);
      return;
    }

    const rule = await this.prisma.notificationRule.findFirst({
      where: { eventType: event.eventType },
      orderBy: { cooldownMinutes: "desc" },
    });
    const payload = this.jsonObject(event.payloadJson);
    const config = this.jsonObject(rule?.conditionJson) as RuleConfig;
    if (rule && !this.matchesCondition(payload, config)) {
      await this.markProcessed(event.id);
      return;
    }
    const fallback = this.defaultTemplate(event.eventType);
    const template = this.template(config, fallback, payload);
    if (!template) {
      await this.markProcessed(event.id);
      return;
    }

    if (rule?.cooldownMinutes) {
      const cooldownStart = new Date(
        Date.now() - rule.cooldownMinutes * 60_000,
      );
      const duplicate = await this.prisma.notification.findFirst({
        where: {
          userId: event.userId,
          category: template.category,
          createdAt: { gte: cooldownStart },
        },
        select: { id: true },
      });
      if (duplicate) {
        await this.markProcessed(event.id);
        return;
      }
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: event.userId,
        sourceEventId: event.id,
        category: template.category,
        title: template.title,
        body: template.body,
        status: "sent",
        deliveryLogs: {
          create: {
            channel: "in_app",
            status: "delivered",
            deliveredAt: new Date(),
          },
        },
      },
    });
    await this.deliverPush(event.userId, notification.id, template);
    await this.markProcessed(event.id);
  }

  private async deliverPush(
    userId: string,
    notificationId: string,
    template: EventTemplate,
  ) {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        userId,
        channel: "push",
        category: { in: ["all", template.category] },
      },
    });
    const preference =
      preferences.find((item) => item.category === template.category) ??
      preferences.find((item) => item.category === "all");
    if (preference?.enabled === false) return;

    const registrations = await this.prisma.pushRegistration.findMany({
      where: { userId, active: true },
    });
    for (const registration of registrations) {
      const result =
        registration.provider === "expo"
          ? await this.sendExpo(registration.token, template)
          : {
              status: "not_configured",
              error: `${registration.provider.toUpperCase()} direct provider adapter requires credentials`,
            };
      await this.prisma.notificationDeliveryLog.create({
        data: {
          notificationId,
          channel: registration.provider,
          providerMessageId: result.messageId,
          status: result.status,
          deliveredAt: result.status === "delivered" ? new Date() : undefined,
        },
      });
      if (result.status === "unregistered") {
        await this.prisma.pushRegistration.update({
          where: { id: registration.id },
          data: { active: false, lastError: result.error },
        });
      } else if (result.error) {
        await this.prisma.pushRegistration.update({
          where: { id: registration.id },
          data: { lastError: result.error.slice(0, 2_000) },
        });
      }
    }
  }

  private async sendExpo(
    token: string,
    template: EventTemplate,
  ): Promise<{
    status: string;
    messageId?: string;
    error?: string;
  }> {
    if (!/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token)) {
      return { status: "unregistered", error: "Invalid Expo push token" };
    }
    const accessToken = this.config.get<string>("EXPO_ACCESS_TOKEN")?.trim();
    let response: Response;
    try {
      response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          to: token,
          title: template.title,
          body: template.body,
          sound: "default",
        }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch (error) {
      return { status: "failed", error: this.errorMessage(error) };
    }
    if (!response.ok)
      return {
        status: "failed",
        error: `Expo returned HTTP ${response.status}`,
      };
    const result = (await response.json()) as {
      data?: {
        status?: string;
        id?: string;
        message?: string;
        details?: { error?: string };
      };
    };
    // Expo only acknowledges that the push was accepted for delivery here.
    // Final delivery requires checking push receipts separately.
    if (result.data?.status === "ok")
      return { status: "accepted", messageId: result.data.id };
    const providerError = result.data?.details?.error;
    return {
      status:
        providerError === "DeviceNotRegistered" ? "unregistered" : "failed",
      error:
        result.data?.message ??
        providerError ??
        "Expo rejected the notification",
    };
  }

  private defaultTemplate(eventType: string): EventTemplate | null {
    const templates: Record<string, EventTemplate> = {
      session_completed: {
        category: "activity",
        title: "Session saved",
        body: "Your latest activity session has finished processing.",
      },
      health_sync_completed: {
        category: "health_sync",
        title: "Health data synced",
        body: "Your daily health summaries are up to date.",
      },
      device_low_battery: {
        category: "device",
        title: "Insole battery is low",
        body: "Charge your smart insoles before the next session.",
      },
      content_link_broken: {
        category: "content_admin",
        title: "Published video link needs attention",
        body: "A published exercise video was archived because its YouTube link is unavailable.",
      },
    };
    return templates[eventType] ?? null;
  }

  private template(
    config: RuleConfig,
    fallback: EventTemplate | null,
    payload: Prisma.JsonObject,
  ) {
    const category = config.category ?? fallback?.category;
    const title = config.title ?? fallback?.title;
    const body = config.body ?? fallback?.body;
    if (!category || !title || !body) return null;
    return {
      category: category.slice(0, 80),
      title: this.interpolate(title, payload).slice(0, 200),
      body: this.interpolate(body, payload).slice(0, 2_000),
    };
  }

  private matchesCondition(payload: Prisma.JsonObject, config: RuleConfig) {
    if (!config.field || !config.operator) return true;
    const actual = payload[config.field];
    if (config.operator === "eq") return actual === config.value;
    if (typeof actual !== "number" || typeof config.value !== "number")
      return false;
    return config.operator === "gte"
      ? actual >= config.value
      : actual <= config.value;
  }

  private interpolate(value: string, payload: Prisma.JsonObject) {
    return value.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, key: string) => {
      const replacement = payload[key];
      return ["string", "number", "boolean"].includes(typeof replacement)
        ? String(replacement)
        : "";
    });
  }

  private jsonObject(
    value: Prisma.JsonValue | null | undefined,
  ): Prisma.JsonObject {
    return value && !Array.isArray(value) && typeof value === "object"
      ? (value as Prisma.JsonObject)
      : {};
  }

  private markProcessed(id: string) {
    return this.prisma.notificationEvent.update({
      where: { id },
      data: { processedAt: new Date(), processingError: null },
    });
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
