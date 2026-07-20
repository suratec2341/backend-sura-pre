import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { QUEUES } from '@blansole/shared';

@Injectable()
export class SessionProcessingQueueService implements OnModuleDestroy {
  private queue?: Queue;

  constructor(private readonly config: ConfigService) {}

  async enqueue(sessionId: string) {
    const queue = this.getQueue();
    await queue.add(
      'process-session',
      { sessionId },
      {
        jobId: `session-${sessionId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    if (!this.queue) {
      const port = Number(this.config.get<string>('REDIS_PORT') ?? 6379);
      this.queue = new Queue(QUEUES.SESSION_PROCESS, {
        connection: {
          host: this.config.get<string>('REDIS_HOST', 'localhost'),
          port: Number.isNaN(port) ? 6379 : port,
        },
      });
    }
    return this.queue;
  }
}
