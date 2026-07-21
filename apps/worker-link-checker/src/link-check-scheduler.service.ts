import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUES } from "@blansole/shared";

@Injectable()
export class LinkCheckSchedulerService implements OnModuleInit {
  constructor(@InjectQueue(QUEUES.LINK_CHECK) private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      "check-published-links",
      {},
      {
        jobId: "daily-published-link-check",
        repeat: { pattern: "0 3 * * *" },
        removeOnComplete: 10,
        removeOnFail: 100,
      },
    );
  }
}
