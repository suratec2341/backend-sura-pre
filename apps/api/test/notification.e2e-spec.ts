import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

// Mock sanitize-html before importing AppModule
jest.mock('sanitize-html', () => jest.fn((input) => input));

import { AppModule } from '../src/app.module';
import { API_PREFIX, PrismaService } from '@blansole/shared';

describe('Notification Controllers (e2e)', () => {
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

  describe('/api/v1/notifications', () => {
    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/notifications`)
        .expect(200)
        .expect({ message: 'List notifications — TODO' });
    });

    it('/read (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/notifications/read`)
        .send({ notificationIds: ['1', '2'] })
        .expect(201)
        .expect({ message: 'Mark read — TODO' });
    });
  });

  describe('/api/v1/notification-settings', () => {
    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/notification-settings`)
        .expect(200)
        .expect({ message: 'Get notification settings — TODO' });
    });

    it('/ (PUT)', () => {
      return request(app.getHttpServer())
        .put(`/${API_PREFIX}/notification-settings`)
        .send({ pushEnabled: true })
        .expect(200)
        .expect({ message: 'Update notification settings — TODO' });
    });
  });
});
