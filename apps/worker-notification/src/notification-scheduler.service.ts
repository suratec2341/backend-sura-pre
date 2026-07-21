import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUES } from "@blansole/shared";

@Injectable()
export class NotificationSchedulerService implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUES.NOTIFICATION) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await this.queue.add(
      "sweep-events",
      {},
      {
        jobId: "notification-event-sweep",
        repeat: { every: 15_000 },
        removeOnComplete: 10,
        removeOnFail: 100,
      },
    );
  }
}
