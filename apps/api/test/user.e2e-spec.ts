import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { authenticatedRequest as request } from './authenticated-request';

jest.mock('sanitize-html', () => jest.fn((input) => input));

import { AppModule } from '../src/app.module';
import { UserService } from '../src/modules/user/user.service';
import { API_PREFIX, PrismaService } from '@blansole/shared';

describe('User Controller (e2e)', () => {
  let app: INestApplication;
  const userService = {
    getMe: jest.fn().mockResolvedValue({ id: 'user-test-user', profile: { name: 'John' } }),
    updateProfile: jest.fn().mockResolvedValue({ id: 'user-test-user', profile: { name: 'John Doe' } }),
    getGoals: jest.fn().mockResolvedValue({ items: [], dailyProgress: { steps: 0 } }),
    updateGoal: jest.fn().mockResolvedValue({ id: 'goal-1', goalType: 'daily_steps' }),
    getSettings: jest.fn().mockResolvedValue({ language: 'th' }),
    updateSettings: jest.fn().mockResolvedValue({ language: 'en' }),
    getConsents: jest.fn().mockResolvedValue([]),
    updateConsent: jest.fn().mockResolvedValue({ consentType: 'marketing', granted: true }),
    getHealth: jest.fn().mockResolvedValue([]),
    updateHealth: jest.fn().mockResolvedValue({ id: 'health-1', painLevel: 3 }),
    getRisks: jest.fn().mockResolvedValue({ items: [], latest: {} }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(UserService)
      .useValue(userService)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(() => app.close());

  it('returns the current user profile', () =>
    request(app.getHttpServer()).get(`/${API_PREFIX}/me`).expect(200).expect({
      id: 'user-test-user',
      profile: { name: 'John' },
    }));

  it('updates onboarding fields using frontend names', () =>
    request(app.getHttpServer())
      .put(`/${API_PREFIX}/me/profile`)
      .send({ name: 'John Doe', birthday: '1994-07-20', weight: 70, shoeType: 'running', painPoints: ['heel'] })
      .expect(200)
      .expect({ id: 'user-test-user', profile: { name: 'John Doe' } }));

  it('returns goals with daily progress', () =>
    request(app.getHttpServer())
      .get(`/${API_PREFIX}/me/goals`)
      .expect(200)
      .expect({ items: [], dailyProgress: { steps: 0 } }));

  it('updates a goal', () =>
    request(app.getHttpServer())
      .put(`/${API_PREFIX}/me/goals`)
      .send({ goal: 'daily_steps', targetSteps: 8000 })
      .expect(200)
      .expect({ id: 'goal-1', goalType: 'daily_steps' }));

  it('reads and updates settings', async () => {
    await request(app.getHttpServer()).get(`/${API_PREFIX}/me/settings`).expect(200).expect({ language: 'th' });
    await request(app.getHttpServer()).put(`/${API_PREFIX}/me/settings`).send({ language: 'en' }).expect(200).expect({ language: 'en' });
  });

  it('reads and updates consent', async () => {
    await request(app.getHttpServer()).get(`/${API_PREFIX}/me/consents`).expect(200).expect([]);
    await request(app.getHttpServer())
      .put(`/${API_PREFIX}/me/consents/marketing`)
      .send({ granted: true, version: '1.0' })
      .expect(200)
      .expect({ consentType: 'marketing', granted: true });
  });

  it('exposes health history and latest risks', async () => {
    await request(app.getHttpServer()).get(`/${API_PREFIX}/me/health`).expect(200).expect([]);
    await request(app.getHttpServer())
      .put(`/${API_PREFIX}/me/health`)
      .send({ painLevel: 3, painPoints: ['heel'] })
      .expect(200)
      .expect({ id: 'health-1', painLevel: 3 });
    await request(app.getHttpServer()).get(`/${API_PREFIX}/me/risks`).expect(200).expect({ items: [], latest: {} });
  });
});
