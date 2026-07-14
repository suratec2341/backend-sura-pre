import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '@blansole/shared';

@Processor(QUEUES.HEALTH_SYNC)
export class HealthSyncProcessor extends WorkerHost {
  async process(job: Job): Promise<void> {
    const { integrationId, userId } = job.data ?? {};
    console.log(
      `Processing health sync job ${job.id}: integration=${integrationId ?? 'n/a'}, user=${userId ?? 'n/a'}`,
    );

    // TODO: fetch Apple Health / Health Connect records and persist summaries.
  }
}
