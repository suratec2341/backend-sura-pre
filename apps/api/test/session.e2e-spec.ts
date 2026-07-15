import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

// Mock sanitize-html before importing AppModule
jest.mock('sanitize-html', () => jest.fn((input) => input));

import { AppModule } from '../src/app.module';
import { API_PREFIX, PrismaService } from '@blansole/shared';

describe('Session Controller (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(true),
    $disconnect: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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

  describe('/api/v1/sessions', () => {
    it('/start (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/sessions/start`)
        .send({})
        .expect(201)
        .expect({ message: 'Start session — TODO' });
    });

    it('/:id/data (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/sessions/123/data`)
        .send({})
        .expect(201)
        .expect({ message: 'Push data to 123 — TODO' });
    });

    it('/:id/finish (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/sessions/123/finish`)
        .send({})
        .expect(201)
        .expect({ message: 'Finish session 123 — TODO (→ enqueue worker)' });
    });

    it('/sync-batch (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/sessions/sync-batch`)
        .send({})
        .expect(201)
        .expect({ message: 'Offline sync batch — TODO' });
    });

    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/sessions`)
        .expect(200)
        .expect({ message: 'List sessions — TODO' });
    });

    it('/:id (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/sessions/123`)
        .expect(200)
        .expect({ message: 'Get session 123 — TODO' });
    });

    it('/:id/pressure-map (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/sessions/123/pressure-map`)
        .expect(200)
        .expect({ message: 'Pressure map 123 — TODO' });
    });

    it('/:id/gait-analysis (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/sessions/123/gait-analysis`)
        .expect(200)
        .expect({ message: 'Gait analysis 123 — TODO' });
    });

    it('/:id/insight (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/sessions/123/insight`)
        .expect(200)
        .expect({ message: 'AI insight 123 — TODO' });
    });
  });
});
