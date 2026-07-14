import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '@blansole/shared';

@Processor(QUEUES.EPISODE_SUMMARY)
export class EpisodeSummaryProcessor extends WorkerHost {
  async process(job: Job): Promise<void> {
    const { periodType, userId } = job.data ?? {};
    console.log(
      `Processing episode summary job ${job.id}: user=${userId ?? 'all'}, period=${periodType ?? 'weekly'}`,
    );

    // TODO: distill session metrics and chat history into episode_summaries.
  }
}
