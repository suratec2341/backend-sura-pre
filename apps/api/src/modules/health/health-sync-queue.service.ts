import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QUEUES } from "@blansole/shared";
import { Queue } from "bullmq";
import { HealthDailySummaryDto } from "./dto/health.dto";

export interface HealthSyncJobData {
  syncLogId: string;
  integrationId: string;
  userId: string;
  summaries: HealthDailySummaryDto[];
}

@Injectable()
export class HealthSyncQueueService implements OnModuleDestroy {
  private queue?: Queue<HealthSyncJobData>;

  constructor(private readonly config: ConfigService) {}

  enqueue(data: HealthSyncJobData) {
    return this.getQueue().add("sync-health-summaries", data, {
      jobId: `health-sync-${data.syncLogId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: 1_000,
      removeOnFail: 1_000,
    });
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    if (!this.queue) {
      const port = Number(this.config.get<string>("REDIS_PORT") ?? 6379);
      this.queue = new Queue<HealthSyncJobData>(QUEUES.HEALTH_SYNC, {
        connection: {
          host: this.config.get<string>("REDIS_HOST", "localhost"),
          port: Number.isNaN(port) ? 6379 : port,
        },
      });
    }
    return this.queue;
  }
}
