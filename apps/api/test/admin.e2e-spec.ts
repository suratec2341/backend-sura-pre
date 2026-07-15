import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

// Mock sanitize-html before importing AppModule
jest.mock('sanitize-html', () => jest.fn((input) => input));

import { AppModule } from '../src/app.module';
import { API_PREFIX, PrismaService } from '@blansole/shared';

describe('Admin Content Controller (e2e)', () => {
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

  describe('/api/v1/admin/content/programs', () => {
    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/admin/content/programs`)
        .expect(200)
        .expect({ message: 'List programs — TODO' });
    });

    it('/ (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/admin/content/programs`)
        .send({})
        .expect(201)
        .expect({ message: 'Create program — TODO' });
    });

    it('/:id (PUT)', () => {
      return request(app.getHttpServer())
        .put(`/${API_PREFIX}/admin/content/programs/123`)
        .send({})
        .expect(200)
        .expect({ message: 'Update program 123 — TODO' });
    });

    it('/:id/submit-review (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/admin/content/programs/123/submit-review`)
        .send({})
        .expect(201)
        .expect({ message: 'Submit for review 123 — TODO' });
    });

    it('/:id/publish (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/admin/content/programs/123/publish`)
        .send({})
        .expect(201)
        .expect({ message: 'Publish 123 — TODO' });
    });

    it('/:id/unpublish (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/admin/content/programs/123/unpublish`)
        .send({})
        .expect(201)
        .expect({ message: 'Unpublish 123 — TODO' });
    });
  });

  describe('/api/v1/admin/content/videos', () => {
    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/admin/content/videos`)
        .expect(200)
        .expect({ message: 'List videos — TODO' });
    });

    it('/ (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/admin/content/videos`)
        .send({})
        .expect(201)
        .expect({ message: 'Create video (youtube_url + ai_description) — TODO' });
    });

    it('/:id (PUT)', () => {
      return request(app.getHttpServer())
        .put(`/${API_PREFIX}/admin/content/videos/123`)
        .send({})
        .expect(200)
        .expect({ message: 'Update video 123 — TODO' });
    });

    it('/:id/recheck-link (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/admin/content/videos/123/recheck-link`)
        .send({})
        .expect(201)
        .expect({ message: 'Recheck YouTube link 123 — TODO' });
    });
  });

  describe('/api/v1/admin/content/tags & rules', () => {
    it('/tags (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/admin/content/tags`)
        .expect(200)
        .expect({ message: 'List tags — TODO' });
    });

    it('/rules (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/admin/content/rules`)
        .send({})
        .expect(201)
        .expect({ message: 'Create recommendation rule — TODO' });
    });

    it('/review-logs (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/admin/content/review-logs`)
        .expect(200)
        .expect({ message: 'Review logs — TODO' });
    });
  });
});
