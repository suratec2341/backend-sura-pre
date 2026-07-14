import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '@blansole/shared';

@Processor(QUEUES.SESSION_PROCESS)
export class SessionProcessor extends WorkerHost {
  async process(job: Job): Promise<void> {
    const { sessionId } = job.data;
    console.log(`Processing session: ${sessionId}`);

    // TODO: §9 Worker flow
    // 1. Upload pressure map / route to Object Storage
    // 2. Compute metrics, gait analysis, pressure zones (with algorithm_version)
    // 3. Enqueue generate_ai_summary
    // 4. Enqueue check_notification_rules
  }
}
