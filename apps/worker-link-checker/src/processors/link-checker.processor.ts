import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '@blansole/shared';

@Processor(QUEUES.LINK_CHECK)
export class LinkCheckerProcessor extends WorkerHost {
  async process(job: Job): Promise<void> {
    const { videoId } = job.data ?? {};
    console.log(`Processing link check job ${job.id}: video=${videoId ?? 'all'}`);

    // TODO: check YouTube oEmbed for published videos and update link_status.
  }
}
