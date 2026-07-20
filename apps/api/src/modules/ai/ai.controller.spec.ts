import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, Role } from '@blansole/shared';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

jest.mock('../../utils/sanitizer.util', () => ({
  sanitizeAiPrompt: jest.fn((input) => input),
}));

describe('AiController', () => {
  let controller: AiController;
  let aiService: {
    dispatchSessionSummaryTask: jest.Mock;
    dispatchChatMessageTask: jest.Mock;
    dispatchEmbedDocumentTask: jest.Mock;
    getTaskState: jest.Mock;
  };
  let prisma: any;

  const user = { userId: 'user-1', role: Role.USER };

  beforeEach(async () => {
    aiService = {
      dispatchSessionSummaryTask: jest.fn().mockResolvedValue('task-summary'),
      dispatchChatMessageTask: jest.fn().mockResolvedValue('task-chat'),
      dispatchEmbedDocumentTask: jest.fn().mockResolvedValue('task-embed'),
      getTaskState: jest.fn(),
    };

    const transactionClient = {
      ragDocument: {
        create: jest.fn().mockResolvedValue({ id: 'document-1' }),
      },
      ragChunk: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma = {
      activitySession: { findFirst: jest.fn() },
      aiChatThread: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(transactionClient)),
      transactionClient,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiService, useValue: aiService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    controller = module.get(AiController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('queues a summary only for a session owned by the user', async () => {
    prisma.activitySession.findFirst.mockResolvedValue({ id: 'session-1' });

    await expect(
      controller.sessionSummary(user, { sessionId: 'session-1' }),
    ).resolves.toEqual({
      message: 'AI session summary task queued',
      taskId: 'task-summary',
    });
    expect(prisma.activitySession.findFirst).toHaveBeenCalledWith({
      where: { id: 'session-1', userId: 'user-1' },
      select: { id: true },
    });
  });

  it('does not reveal a session owned by another user', async () => {
    prisma.activitySession.findFirst.mockResolvedValue(null);

    await expect(
      controller.sessionSummary(user, { sessionId: 'other-session' }),
    ).rejects.toThrow(NotFoundException);
    expect(aiService.dispatchSessionSummaryTask).not.toHaveBeenCalled();
  });

  it('queues chat only for an active thread owned by the user', async () => {
    prisma.aiChatThread.findFirst.mockResolvedValue({
      id: 'thread-1',
      archivedAt: null,
    });

    await expect(
      controller.chat(user, { threadId: 'thread-1', message: 'Hello' }),
    ).resolves.toEqual({
      message: 'AI chat task queued',
      taskId: 'task-chat',
      threadId: 'thread-1',
    });
    expect(aiService.dispatchChatMessageTask).toHaveBeenCalledWith(
      'thread-1',
      'Hello',
    );
  });

  it('rejects chat on an archived thread', async () => {
    prisma.aiChatThread.findFirst.mockResolvedValue({
      id: 'thread-1',
      archivedAt: new Date(),
    });

    await expect(
      controller.chat(user, { threadId: 'thread-1', message: 'Hello' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a chat thread for the authenticated user', async () => {
    prisma.aiChatThread.create.mockResolvedValue({ id: 'thread-1' });

    await controller.createThread(user, { title: '  My health chat  ' });

    expect(prisma.aiChatThread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 'user-1', title: 'My health chat' },
      }),
    );
  });

  it('creates bounded RAG chunks in one transaction before dispatch', async () => {
    const result = await controller.ingestRagDocument({
      title: 'Pressure guide',
      category: 'guideline',
      text: 'A'.repeat(8_500),
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.transactionClient.ragDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isActive: false }),
    });
    expect(prisma.transactionClient.ragChunk.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ documentId: 'document-1', chunkIndex: 0 }),
      ]),
    });
    expect(result).toEqual(
      expect.objectContaining({
        documentId: 'document-1',
        taskId: 'task-embed',
      }),
    );
  });

  it('does not expose a successful task from another thread', async () => {
    prisma.aiChatThread.findFirst.mockResolvedValue({ id: 'thread-1' });
    aiService.getTaskState.mockResolvedValue({
      taskId: 'task-1',
      status: 'SUCCESS',
      result: { threadId: 'thread-2' },
    });

    await expect(
      controller.getChatTaskState(user, 'thread-1', 'task-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
