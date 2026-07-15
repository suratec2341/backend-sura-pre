import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

// Mock sanitize-html before importing AppModule
jest.mock('sanitize-html', () => jest.fn((input) => input));

import { AppModule } from '../src/app.module';
import { API_PREFIX, PrismaService } from '@blansole/shared';

describe('User Controller (e2e)', () => {
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

  describe('/api/v1/me', () => {
    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/me`)
        .expect(200)
        .expect({ message: 'Get profile — not implemented yet' });
    });

    it('/profile (PUT)', () => {
      return request(app.getHttpServer())
        .put(`/${API_PREFIX}/me/profile`)
        .send({ name: 'John Doe' })
        .expect(200)
        .expect({ message: 'Update profile — not implemented yet' });
    });

    it('/goals (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/me/goals`)
        .expect(200)
        .expect({ message: 'Get goals — not implemented yet' });
    });

    it('/goals (PUT)', () => {
      return request(app.getHttpServer())
        .put(`/${API_PREFIX}/me/goals`)
        .send({ target: 100 })
        .expect(200)
        .expect({ message: 'Update goals — not implemented yet' });
    });

    it('/settings (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/me/settings`)
        .expect(200)
        .expect({ message: 'Get settings — not implemented yet' });
    });

    it('/settings (PUT)', () => {
      return request(app.getHttpServer())
        .put(`/${API_PREFIX}/me/settings`)
        .send({ theme: 'dark' })
        .expect(200)
        .expect({ message: 'Update settings — not implemented yet' });
    });

    it('/consents (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/me/consents`)
        .expect(200)
        .expect({ message: 'Get consents — not implemented yet' });
    });

    it('/consents/:type (PUT)', () => {
      return request(app.getHttpServer())
        .put(`/${API_PREFIX}/me/consents/marketing`)
        .send({ value: true })
        .expect(200)
        .expect({ message: 'Update consent — not implemented yet' });
    });
  });
});
