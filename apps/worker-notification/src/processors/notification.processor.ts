import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '@blansole/shared';

@Processor(QUEUES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  async process(job: Job): Promise<void> {
    console.log(`Sending notification: ${job.id}`);
    // TODO: evaluate rules + cooldown (Redis) → save notification → push via FCM/APNs
  }
}
