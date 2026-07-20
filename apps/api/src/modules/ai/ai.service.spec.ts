import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import * as celery from 'celery-node';

jest.mock('celery-node', () => ({
  createClient: jest.fn().mockReturnValue({
    disconnect: jest.fn(),
    asyncResult: jest.fn().mockReturnValue({
      status: jest.fn().mockResolvedValue('SUCCESS'),
      result: jest.fn().mockResolvedValue({ threadId: 'thread-123' }),
    }),
    createTask: jest.fn().mockReturnValue({
      applyAsync: jest.fn().mockReturnValue({ taskId: 'mocked-task-id' }),
    }),
  }),
}));

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService],
    }).compile();

    service = module.get<AiService>(AiService);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should dispatch session summary task', async () => {
    const taskId = await service.dispatchSessionSummaryTask('session-123');
    expect(taskId).toBe('mocked-task-id');
    expect(celery.createClient).toHaveBeenCalled();
  });

  it('should dispatch chat message task', async () => {
    const taskId = await service.dispatchChatMessageTask('thread-123', 'Hello AI');
    expect(taskId).toBe('mocked-task-id');
  });

  it('should dispatch document embedding task', async () => {
    const taskId = await service.dispatchEmbedDocumentTask('document-123');
    expect(taskId).toBe('mocked-task-id');
  });

  it('should return completed task state and result', async () => {
    await expect(service.getTaskState('task-123')).resolves.toEqual({
      taskId: 'task-123',
      status: 'SUCCESS',
      result: { threadId: 'thread-123' },
    });
  });
});
