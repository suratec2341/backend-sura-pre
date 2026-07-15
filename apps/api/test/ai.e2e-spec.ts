import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

// Mock sanitize-html before importing AppModule
jest.mock('sanitize-html', () => jest.fn((input) => input));

import { AppModule } from '../src/app.module';
import { AiService } from '../src/modules/ai/ai.service';
import { API_PREFIX, PrismaService } from '@blansole/shared';

describe('AI Controller (e2e)', () => {
  let app: INestApplication;
  
  // Create a mock of AiService
  const mockAiService = {
    dispatchSessionSummaryTask: jest.fn().mockResolvedValue('mock-task-id-123'),
    dispatchChatMessageTask: jest.fn().mockResolvedValue('mock-task-id-456'),
  };

  // Mock PrismaService to prevent it from connecting to a database during tests
  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(true),
    $disconnect: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    // Override the real AiService with our mock so we don't connect to Celery during tests
    .overrideProvider(AiService)
    .useValue(mockAiService)
    // Override PrismaService to avoid needing DATABASE_URL in .env
    .overrideProvider(PrismaService)
    .useValue(mockPrismaService)
    .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/ai/session-summary (POST)', () => {
    it('should return error if sessionId is missing', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/ai/session-summary`)
        .send({})
        .expect(201)
        .expect({
          message: 'Missing sessionId'
        });
    });

    it('should queue task successfully if sessionId is provided', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/ai/session-summary`)
        .send({ sessionId: 'session-xyz' })
        .expect(201)
        .expect({
          message: 'AI session summary task queued',
          taskId: 'mock-task-id-123'
        });
    });
  });

  describe('/api/v1/ai/chat (POST)', () => {
    it('should return error if threadId or message is missing', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/ai/chat`)
        .send({ threadId: 'thread-1' }) // Missing message
        .expect(201)
        .expect({
          message: 'Missing threadId or message'
        });
    });

    it('should queue chat task successfully if data is valid', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/ai/chat`)
        .send({ threadId: 'thread-1', message: 'Hello AI' })
        .expect(201)
        .expect({
          message: 'AI chat task queued',
          taskId: 'mock-task-id-456',
          received: 'Hello AI'
        });
    });
  });
});
