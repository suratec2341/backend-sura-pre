import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService, QUEUES } from "@blansole/shared";

interface EpisodeSummaryJobData {
  periodType?: "weekly" | "monthly";
  userId?: string;
  periodStart?: string;
  periodEnd?: string;
}

@Processor(QUEUES.EPISODE_SUMMARY)
export class EpisodeSummaryProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<EpisodeSummaryJobData>): Promise<void> {
    const periodType = job.data?.periodType ?? "weekly";
    const { start, end } = this.periodBounds(
      periodType,
      job.data?.periodStart,
      job.data?.periodEnd,
    );
    const userIds = job.data?.userId
      ? [job.data.userId]
      : (
          await this.prisma.user.findMany({
            where: { status: "active" },
            select: { id: true },
          })
        ).map((user) => user.id);

    for (const userId of userIds)
      await this.summarizeUser(userId, periodType, start, end);
  }

  private async summarizeUser(
    userId: string,
    periodType: string,
    start: Date,
    end: Date,
  ) {
    const [sessions, chatMessages] = await Promise.all([
      this.prisma.activitySession.findMany({
        where: {
          userId,
          startedAt: { gte: start, lt: end },
          status: "completed",
        },
        include: { metrics: true },
      }),
      this.prisma.aiChatMessage.count({
        where: { thread: { userId }, createdAt: { gte: start, lt: end } },
      }),
    ]);
    const metrics = sessions.reduce(
      (total, session) => ({
        steps: total.steps + (session.metrics?.steps ?? 0),
        distanceKm: total.distanceKm + (session.metrics?.distanceKm ?? 0),
        calories: total.calories + (session.metrics?.calories ?? 0),
        durationSec: total.durationSec + (session.durationSec ?? 0),
      }),
      { steps: 0, distanceKm: 0, calories: 0, durationSec: 0 },
    );
    const keyMetrics = {
      sessions: sessions.length,
      steps: metrics.steps,
      distanceKm: Math.round(metrics.distanceKm * 100) / 100,
      calories: Math.round(metrics.calories * 10) / 10,
      durationMinutes: Math.round(metrics.durationSec / 60),
      chatMessages,
    };
    const summaryText = sessions.length
      ? `Completed ${sessions.length} sessions with ${metrics.steps.toLocaleString("en-US")} steps and ${keyMetrics.distanceKm} km during this ${periodType} period.`
      : `No completed activity sessions were recorded during this ${periodType} period.`;

    await this.prisma.episodeSummary.upsert({
      where: {
        userId_periodType_periodStart_periodEnd: {
          userId,
          periodType,
          periodStart: start,
          periodEnd: end,
        },
      },
      create: {
        userId,
        periodType,
        periodStart: start,
        periodEnd: end,
        summaryText,
        keyMetricsJson: keyMetrics,
        algorithmVersion: "deterministic-aggregate-v1",
      },
      update: {
        summaryText,
        keyMetricsJson: keyMetrics,
        generatedAt: new Date(),
        algorithmVersion: "deterministic-aggregate-v1",
      },
    });
  }

  private periodBounds(
    type: "weekly" | "monthly",
    explicitStart?: string,
    explicitEnd?: string,
  ) {
    if (explicitStart && explicitEnd) {
      const start = new Date(explicitStart);
      const end = new Date(explicitEnd);
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        start >= end
      ) {
        throw new Error("Invalid episode summary period");
      }
      return { start, end };
    }
    const now = new Date();
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    if (type === "monthly") {
      end.setUTCDate(1);
      return {
        start: new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1),
        ),
        end,
      };
    }
    return { start: new Date(end.getTime() - 7 * 24 * 60 * 60 * 1_000), end };
  }
}
