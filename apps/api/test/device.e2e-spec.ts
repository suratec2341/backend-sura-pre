import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

// Mock sanitize-html before importing AppModule
jest.mock('sanitize-html', () => jest.fn((input) => input));

import { AppModule } from '../src/app.module';
import { API_PREFIX, PrismaService } from '@blansole/shared';

describe('Device Controller (e2e)', () => {
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

  describe('/api/v1/devices', () => {
    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/devices`)
        .expect(200)
        .expect({ message: 'List devices — TODO' });
    });

    it('/pair (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/devices/pair`)
        .send({})
        .expect(201)
        .expect({ message: 'Pair device — TODO' });
    });

    it('/:id (PUT)', () => {
      return request(app.getHttpServer())
        .put(`/${API_PREFIX}/devices/123`)
        .send({})
        .expect(200)
        .expect({ message: 'Update device 123 — TODO' });
    });

    it('/:id (DELETE)', () => {
      return request(app.getHttpServer())
        .delete(`/${API_PREFIX}/devices/123`)
        .expect(200)
        .expect({ message: 'Remove device 123 — TODO' });
    });

    it('/:id/sync (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/devices/123/sync`)
        .send({})
        .expect(201)
        .expect({ message: 'Sync device 123 — TODO' });
    });

    it('/:id/status (GET)', () => {
      return request(app.getHttpServer())
        .get(`/${API_PREFIX}/devices/123/status`)
        .expect(200)
        .expect({ message: 'Device 123 status — TODO' });
    });

    it('/:id/battery (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/devices/123/battery`)
        .send({})
        .expect(201)
        .expect({ message: 'Battery log 123 — TODO' });
    });

    it('/:id/calibrate (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/devices/123/calibrate`)
        .send({})
        .expect(201)
        .expect({ message: 'Calibrate 123 — TODO' });
    });
  });
});
