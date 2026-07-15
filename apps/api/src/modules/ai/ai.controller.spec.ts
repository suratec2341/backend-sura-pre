import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ThrottlerModule } from '@nestjs/throttler';

jest.mock('../../utils/sanitizer.util', () => ({
  sanitizeAiPrompt: jest.fn((input) => input),
}));

describe('AiController', () => {
  let controller: AiController;
  let service: AiService;

  beforeEach(async () => {
    const mockAiService = {
      dispatchSessionSummaryTask: jest.fn().mockResolvedValue('task-session-summary'),
      dispatchChatMessageTask: jest.fn().mockResolvedValue('task-chat-message'),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{
          ttl: 60000,
          limit: 10,
        }]),
      ],
      controllers: [AiController],
      providers: [
        {
          provide: AiService,
          useValue: mockAiService,
        },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sessionSummary', () => {
    it('should return missing sessionId error if body is empty', async () => {
      const result = await controller.sessionSummary({});
      expect(result).toEqual({ message: 'Missing sessionId' });
      expect(service.dispatchSessionSummaryTask).not.toHaveBeenCalled();
    });

    it('should dispatch task and return taskId if sessionId is provided', async () => {
      const result = await controller.sessionSummary({ sessionId: 'session-123' });
      expect(service.dispatchSessionSummaryTask).toHaveBeenCalledWith('session-123');
      expect(result).toEqual({ message: 'AI session summary task queued', taskId: 'task-session-summary' });
    });
  });

  describe('chat', () => {
    it('should return missing threadId or message error if body is invalid', async () => {
      const result = await controller.chat({ threadId: 'thread-123' });
      expect(result).toEqual({ message: 'Missing threadId or message' });
      expect(service.dispatchChatMessageTask).not.toHaveBeenCalled();
    });

    it('should dispatch task and return taskId if body is valid', async () => {
      const result = await controller.chat({ threadId: 'thread-123', message: 'Hello' });
      expect(service.dispatchChatMessageTask).toHaveBeenCalledWith('thread-123', 'Hello');
      expect(result).toEqual({ 
        message: 'AI chat task queued', 
        taskId: 'task-chat-message', 
        received: 'Hello' 
      });
    });
  });
});
