import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@blansole/shared";
import {
  NotificationListQueryDto,
  NotificationPreferenceDto,
  RegisterPushDeviceDto,
  UpdateNotificationSettingsDto,
} from "./dto/notification.dto";

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: NotificationListQueryDto) {
    const where = {
      userId,
      ...(query.unreadOnly ? { status: { not: "read" } } : {}),
    };
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit ?? 50,
      }),
      this.prisma.notification.count({
        where: { userId, status: { not: "read" } },
      }),
    ]);
    return { items, unreadCount };
  }

  async markRead(userId: string, notificationIds: string[]) {
    if (!notificationIds.length) return { updated: 0 };
    const result = await this.prisma.notification.updateMany({
      where: { userId, id: { in: [...new Set(notificationIds)] } },
      data: { status: "read" },
    });
    return { updated: result.count };
  }

  getSettings(userId: string) {
    return this.prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: [{ category: "asc" }, { channel: "asc" }],
    });
  }

  async updateSettings(userId: string, body: UpdateNotificationSettingsDto) {
    const preferences: NotificationPreferenceDto[] = [
      ...(body.preferences ?? []),
    ];
    if (body.pushEnabled !== undefined) {
      preferences.push({
        channel: "push",
        category: "all",
        enabled: body.pushEnabled,
        quietHoursStart: body.quietHoursStart,
        quietHoursEnd: body.quietHoursEnd,
      });
    }
    if (body.emailEnabled !== undefined) {
      preferences.push({
        channel: "email",
        category: "all",
        enabled: body.emailEnabled,
        quietHoursStart: body.quietHoursStart,
        quietHoursEnd: body.quietHoursEnd,
      });
    }

    await this.prisma.$transaction(
      preferences.map((preference) =>
        this.prisma.notificationPreference.upsert({
          where: {
            userId_channel_category: {
              userId,
              channel: preference.channel,
              category: preference.category,
            },
          },
          create: { userId, ...preference },
          update: {
            enabled: preference.enabled,
            quietHoursStart: preference.quietHoursStart,
            quietHoursEnd: preference.quietHoursEnd,
          },
        }),
      ),
    );
    return this.getSettings(userId);
  }

  async registerPushDevice(userId: string, body: RegisterPushDeviceDto) {
    const registration = await this.prisma.pushRegistration.upsert({
      where: { token: body.token.trim() },
      create: {
        userId,
        token: body.token.trim(),
        provider: body.provider,
        platform: body.platform,
      },
      update: {
        userId,
        provider: body.provider,
        platform: body.platform,
        active: true,
        lastError: null,
      },
    });
    return this.safeRegistration(registration);
  }

  async listPushDevices(userId: string) {
    const registrations = await this.prisma.pushRegistration.findMany({
      where: { userId, active: true },
      orderBy: { updatedAt: "desc" },
    });
    return registrations.map((registration) =>
      this.safeRegistration(registration),
    );
  }

  async removePushDevice(userId: string, id: string) {
    const result = await this.prisma.pushRegistration.updateMany({
      where: { id, userId, active: true },
      data: { active: false },
    });
    if (!result.count)
      throw new NotFoundException("Push registration not found");
  }

  private safeRegistration(registration: {
    id: string;
    provider: string;
    platform: string;
    active: boolean;
    token: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: registration.id,
      provider: registration.provider,
      platform: registration.platform,
      active: registration.active,
      tokenSuffix: registration.token.slice(-8),
      createdAt: registration.createdAt,
      updatedAt: registration.updatedAt,
    };
  }
}
