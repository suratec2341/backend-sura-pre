import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService, QUEUES } from "@blansole/shared";

interface HealthSummaryJobRow {
  date: string;
  steps?: number;
  distanceKm?: number;
  calories?: number;
  heartRateAvg?: number;
}

interface HealthSyncJobData {
  syncLogId: string;
  integrationId: string;
  userId: string;
  summaries: HealthSummaryJobRow[];
}

@Processor(QUEUES.HEALTH_SYNC)
export class HealthSyncProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<HealthSyncJobData>): Promise<void> {
    const { syncLogId, integrationId, userId, summaries } =
      job.data ?? ({} as HealthSyncJobData);
    if (!syncLogId || !integrationId || !userId || !Array.isArray(summaries)) {
      throw new Error("Invalid health sync job payload");
    }

    const integration = await this.prisma.healthIntegration.findFirst({
      where: { id: integrationId, userId, status: "connected" },
      select: { id: true },
    });
    if (!integration) {
      await this.failLog(syncLogId);
      throw new Error("Connected health integration not found");
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const summary of summaries) {
          const date = this.utcDate(summary.date);
          await tx.healthDailySummary.upsert({
            where: { userId_date: { userId, date } },
            create: { userId, date, ...this.summaryData(summary) },
            update: this.summaryData(summary),
          });
        }
        await tx.healthSyncLog.update({
          where: { id: syncLogId },
          data: {
            status: "completed",
            syncFinishedAt: new Date(),
            recordsSynced: summaries.length,
          },
        });
        await tx.notificationEvent.create({
          data: {
            userId,
            eventType: "health_sync_completed",
            payloadJson: { integrationId, recordsSynced: summaries.length },
          },
        });
      });
    } catch (error) {
      await this.failLog(syncLogId);
      throw error;
    }
  }

  private summaryData(summary: HealthSummaryJobRow) {
    return {
      steps: summary.steps,
      distanceKm: summary.distanceKm,
      calories: summary.calories,
      heartRateAvg: summary.heartRateAvg,
    };
  }

  private utcDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) throw new Error(`Invalid health summary date: ${value}`);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Error(`Invalid health summary date: ${value}`);
    }
    return date;
  }

  private async failLog(syncLogId: string) {
    await this.prisma.healthSyncLog.updateMany({
      where: { id: syncLogId, status: { not: "completed" } },
      data: { status: "failed", syncFinishedAt: new Date() },
    });
  }
}
