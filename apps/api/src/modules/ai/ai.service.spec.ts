import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import * as celery from 'celery-node';

jest.mock('celery-node', () => ({
  createClient: jest.fn().mockReturnValue({
    disconnect: jest.fn(),
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
});
