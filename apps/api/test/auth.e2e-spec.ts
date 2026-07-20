import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { authenticatedRequest } from './authenticated-request';

jest.mock('sanitize-html', () => jest.fn((input) => input));

import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { API_PREFIX, PrismaService } from '@blansole/shared';

describe('Auth & Account Controllers (e2e)', () => {
  let app: INestApplication;
  const loginResult = {
    accessToken: 'signed-access-token',
    tokenType: 'Bearer',
    expiresIn: '15m',
    user: { id: 'user-test-user', email: 'user@example.com', role: 'user', onboardingComplete: false },
  };
  const authService = {
    loginWithGoogle: jest.fn().mockResolvedValue(loginResult),
    loginWithFacebook: jest.fn().mockResolvedValue(loginResult),
    loginWithApple: jest.fn().mockResolvedValue(loginResult),
    deleteAccount: jest.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-test-user',
        twoFactorEnabled: false,
        twoFactorSecret: null,
      }),
      update: jest.fn().mockResolvedValue({ id: 'user-test-user' }),
    },
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AuthService)
      .useValue(authService)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(() => app.close());

  it('exchanges Google, Facebook, and Apple tokens for a backend JWT', async () => {
    await request(app.getHttpServer()).post(`/${API_PREFIX}/auth/google`).send({ idToken: 'google-token' }).expect(200).expect(loginResult);
    await request(app.getHttpServer()).post(`/${API_PREFIX}/auth/facebook`).send({ accessToken: 'facebook-token' }).expect(200).expect(loginResult);
    await request(app.getHttpServer()).post(`/${API_PREFIX}/auth/apple`).send({ identityToken: 'apple-token' }).expect(200).expect(loginResult);
  });

  it('logs out stateless access-token clients', () =>
    authenticatedRequest(app.getHttpServer()).post(`/${API_PREFIX}/auth/logout`).expect(204));

  it('generates a server-side 2FA secret without exposing it', () =>
    authenticatedRequest(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/2fa/generate`)
      .send({})
      .expect(201)
      .expect((response) => {
        expect(response.body.otpauth_url).toBeDefined();
        expect(response.body.secret).toBeUndefined();
      }));

  it('rejects 2FA verification without a token', () =>
    authenticatedRequest(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/2fa/verify`)
      .send({})
      .expect(400));

  it('deletes the authenticated account and returns no content', () =>
    authenticatedRequest(app.getHttpServer()).delete(`/${API_PREFIX}/account`).expect(204));
});
