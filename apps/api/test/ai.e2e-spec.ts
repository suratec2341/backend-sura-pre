import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { API_PREFIX, PrismaService, Role } from '@blansole/shared';
import * as request from 'supertest';

jest.mock('sanitize-html', () => jest.fn((input) => input));

import { AppModule } from '../src/app.module';
import { AiService } from '../src/modules/ai/ai.service';
import { getTestJwtSecret } from './authenticated-request';

describe('AI Controller (e2e)', () => {
  let app: INestApplication;
  let userToken: string;
  let editorToken: string;

  const mockAiService = {
    dispatchSessionSummaryTask: jest.fn().mockResolvedValue('task-summary'),
    dispatchChatMessageTask: jest.fn().mockResolvedValue('task-chat'),
    dispatchEmbedDocumentTask: jest.fn().mockResolvedValue('task-embed'),
    getTaskState: jest.fn().mockResolvedValue({
      taskId: 'task-chat',
      status: 'SUCCESS',
      result: { threadId: 'thread-1', content: 'AI response' },
    }),
  };

  const transactionClient = {
    ragDocument: {
      create: jest.fn().mockResolvedValue({ id: 'document-1' }),
    },
    ragChunk: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn((callback) => callback(transactionClient)),
    activitySession: {
      findFirst: jest.fn().mockResolvedValue({ id: 'session-1' }),
    },
    aiChatThread: {
      create: jest.fn().mockResolvedValue({
        id: 'thread-1',
        title: 'Health chat',
        createdAt: new Date('2026-07-17T00:00:00.000Z'),
        archivedAt: null,
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'thread-1',
        title: 'Health chat',
        createdAt: new Date('2026-07-17T00:00:00.000Z'),
        archivedAt: null,
        messages: [],
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiService)
      .useValue(mockAiService)
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const jwt = new JwtService({ secret: getTestJwtSecret() });
    userToken = jwt.sign({
      sub: 'user-1',
      email: 'user@example.com',
      role: Role.USER,
    });
    editorToken = jwt.sign({
      sub: 'editor-1',
      email: 'editor@example.com',
      role: Role.CONTENT_EDITOR,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated chat request', () => {
    return request(app.getHttpServer())
      .post(`/${API_PREFIX}/ai/chat`)
      .send({ threadId: 'thread-1', message: 'Hello AI' })
      .expect(401);
  });

  it('validates summary input', () => {
    return request(app.getHttpServer())
      .post(`/${API_PREFIX}/ai/session-summary`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({})
      .expect(400);
  });

  it('queues a summary for an owned session', () => {
    return request(app.getHttpServer())
      .post(`/${API_PREFIX}/ai/session-summary`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ sessionId: 'session-1' })
      .expect(202)
      .expect({
        message: 'AI session summary task queued',
        taskId: 'task-summary',
      });
  });

  it('creates a chat thread for the current user', () => {
    return request(app.getHttpServer())
      .post(`/${API_PREFIX}/ai/chat/threads`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Health chat' })
      .expect(201)
      .expect((response) => {
        expect(response.body.id).toBe('thread-1');
        expect(mockPrismaService.aiChatThread.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ userId: 'user-1' }),
          }),
        );
      });
  });

  it('queues chat for an owned active thread', () => {
    return request(app.getHttpServer())
      .post(`/${API_PREFIX}/ai/chat`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ threadId: 'thread-1', message: 'Hello AI' })
      .expect(202)
      .expect({
        message: 'AI chat task queued',
        taskId: 'task-chat',
        threadId: 'thread-1',
      });
  });

  it('returns a completed task only through its owned thread', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/ai/chat/threads/thread-1/tasks/task-chat`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('SUCCESS');
        expect(response.body.result.content).toBe('AI response');
      });
  });

  it('forbids normal users from ingesting RAG knowledge', () => {
    return request(app.getHttpServer())
      .post(`/${API_PREFIX}/ai/rag/document`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Guide', category: 'guideline', text: 'Trusted text' })
      .expect(403);
  });

  it('allows content editors to ingest bounded RAG knowledge', () => {
    return request(app.getHttpServer())
      .post(`/${API_PREFIX}/ai/rag/document`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ title: 'Guide', category: 'guideline', text: 'Trusted text' })
      .expect(202)
      .expect({
        message: 'Document created and embedding task queued',
        documentId: 'document-1',
        chunkCount: 1,
        taskId: 'task-embed',
      });
  });
});
