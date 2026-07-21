import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@blansole/shared";
import {
  ConnectHealthIntegrationDto,
  SyncHealthIntegrationDto,
} from "./dto/health.dto";
import { HealthSyncQueueService } from "./health-sync-queue.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthSyncQueue: HealthSyncQueueService,
  ) {}

  list(userId: string) {
    return this.prisma.healthIntegration.findMany({
      where: { userId },
      include: {
        syncLogs: { orderBy: { syncStartedAt: "desc" }, take: 10 },
      },
      orderBy: { connectedAt: "desc" },
    });
  }

  async connect(userId: string, body: ConnectHealthIntegrationDto) {
    const existing = await this.prisma.healthIntegration.findFirst({
      where: { userId, provider: body.provider },
      include: { syncLogs: { orderBy: { syncStartedAt: "desc" }, take: 1 } },
    });
    if (existing) {
      if (existing.status === "connected") return existing;
      return this.prisma.healthIntegration.update({
        where: { id: existing.id },
        data: { status: "connected", connectedAt: new Date() },
      });
    }

    return this.prisma.healthIntegration.create({
      data: { userId, provider: body.provider },
    });
  }

  async sync(userId: string, body: SyncHealthIntegrationDto) {
    const integration = await this.prisma.healthIntegration.findFirst({
      where: { id: body.integrationId, userId, status: "connected" },
      select: { id: true },
    });
    if (!integration)
      throw new NotFoundException("Connected health integration not found");

    const log = await this.prisma.healthSyncLog.create({
      data: {
        integrationId: integration.id,
        syncStartedAt: new Date(),
        status: "queued",
      },
    });
    try {
      await this.healthSyncQueue.enqueue({
        syncLogId: log.id,
        integrationId: integration.id,
        userId,
        summaries: body.summaries,
      });
    } catch (error) {
      await this.prisma.healthSyncLog.update({
        where: { id: log.id },
        data: { status: "failed", syncFinishedAt: new Date() },
      });
      throw error;
    }

    return {
      syncLogId: log.id,
      status: "queued",
      recordsQueued: body.summaries.length,
    };
  }

  async disconnect(userId: string, id: string) {
    const integration = await this.prisma.healthIntegration.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!integration)
      throw new NotFoundException("Health integration not found");
    await this.prisma.healthIntegration.update({
      where: { id },
      data: { status: "disconnected" },
    });
  }
}
