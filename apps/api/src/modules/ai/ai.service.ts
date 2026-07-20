import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as celery from 'celery-node';

@Injectable()
export class AiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiService.name);
  private celeryClient: ReturnType<typeof celery.createClient>;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.celeryClient = celery.createClient(redisUrl, redisUrl);
    this.logger.log('Connected to Celery broker via celery-node');
  }

  onModuleDestroy() {
    if (this.celeryClient) {
      this.celeryClient.disconnect();
    }
  }

  async dispatchSessionSummaryTask(sessionId: string): Promise<string> {
    this.logger.log(`Dispatching ai:summary task for session: ${sessionId}`);
    const task = this.celeryClient.createTask('ai:summary');
    const result = task.applyAsync([sessionId]);
    return result.taskId;
  }

  async dispatchChatMessageTask(threadId: string, message: string): Promise<string> {
    this.logger.log(`Dispatching ai:chat task for thread: ${threadId}`);
    const task = this.celeryClient.createTask('ai:chat');
    const result = task.applyAsync([threadId, message]);
    return result.taskId;
  }

  async dispatchEmbedDocumentTask(documentId: string): Promise<string> {
    this.logger.log(`Dispatching ai:embed_document task for document: ${documentId}`);
    const task = this.celeryClient.createTask('ai:embed_document');
    const result = task.applyAsync([documentId]);
    return result.taskId;
  }

  async getTaskState(taskId: string): Promise<{
    taskId: string;
    status: string;
    result?: unknown;
  }> {
    const asyncResult = this.celeryClient.asyncResult(taskId);
    const status = (await asyncResult.status()) ?? 'PENDING';

    if (status !== 'SUCCESS') {
      return { taskId, status };
    }

    return {
      taskId,
      status,
      result: await asyncResult.result(),
    };
  }

  // TODO: deterministic program matching via program_recommendation_rules
}
