import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

// Mock sanitize-html before importing AppModule
jest.mock('sanitize-html', () => jest.fn((input) => input));

import { AppModule } from '../src/app.module';
import { API_PREFIX, PrismaService } from '@blansole/shared';

describe('Auth & Account Controllers (e2e)', () => {
  let app: INestApplication;

  // Mock PrismaService to prevent it from connecting to a database during tests
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

  describe('/api/v1/auth', () => {
    it('/google (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/google`)
        .send({})
        .expect(201)
        .expect({ message: 'Google auth — not implemented yet' });
    });

    it('/facebook (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/facebook`)
        .send({})
        .expect(201)
        .expect({ message: 'Facebook auth — not implemented yet' });
    });

    it('/logout (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/logout`)
        .send({})
        .expect(204);
    });

    it('/2fa/generate (POST)', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/2fa/generate`)
        .send({})
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toBeDefined();
          expect(res.body.secret).toBeDefined();
          expect(res.body.otpauth_url).toBeDefined();
        });
    });

    it('/2fa/verify (POST) - missing token', () => {
      return request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/2fa/verify`)
        .send({})
        .expect(201)
        .expect({ verified: false, message: 'Missing secret or token' });
    });
  });

  describe('/api/v1/account', () => {
    it('/ (DELETE)', () => {
      return request(app.getHttpServer())
        .delete(`/${API_PREFIX}/account`)
        .expect(200)
        .expect({ message: 'Account deletion — not implemented yet' });
    });
  });
});
