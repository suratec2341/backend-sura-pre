import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUES } from "@blansole/shared";

@Injectable()
export class EpisodeSummarySchedulerService implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUES.EPISODE_SUMMARY) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await Promise.all([
      this.queue.add(
        "weekly-summary",
        { periodType: "weekly" },
        {
          jobId: "weekly-episode-summary",
          repeat: { pattern: "15 0 * * 0" },
          removeOnComplete: 10,
          removeOnFail: 100,
        },
      ),
      this.queue.add(
        "monthly-summary",
        { periodType: "monthly" },
        {
          jobId: "monthly-episode-summary",
          repeat: { pattern: "30 0 1 * *" },
          removeOnComplete: 10,
          removeOnFail: 100,
        },
      ),
    ]);
  }
}
