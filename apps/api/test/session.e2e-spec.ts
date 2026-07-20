import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { authenticatedRequest as request } from './authenticated-request';

jest.mock('sanitize-html', () => jest.fn((input) => input));

import { AppModule } from '../src/app.module';
import { SessionService } from '../src/modules/session/session.service';
import { API_PREFIX, PrismaService } from '@blansole/shared';

describe('Session Controller (e2e)', () => {
  let app: INestApplication;
  const service = {
    start: jest.fn().mockResolvedValue({ id: 'session-1', status: 'recording' }),
    pushData: jest.fn().mockResolvedValue({ sessionId: 'session-1', accepted: 1 }),
    finish: jest.fn().mockResolvedValue({ id: 'session-1', status: 'processing', steps: 100 }),
    syncBatch: jest.fn().mockResolvedValue({ sessionId: 'session-1', clientSessionUuid: 'mobile-1', accepted: 1 }),
    list: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    get: jest.fn().mockResolvedValue({ id: 'session-1', steps: 100 }),
    pressureMap: jest.fn().mockResolvedValue({ maps: [], zones: [], balance: { left: 50, right: 50 } }),
    gaitAnalysis: jest.fn().mockResolvedValue({ metrics: null, phases: [] }),
    insight: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(SessionService)
      .useValue(service)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(() => app.close());

  it('starts a session', () =>
    request(app.getHttpServer())
      .post(`/${API_PREFIX}/sessions/start`)
      .send({ activityType: 'walking', clientSessionUuid: 'mobile-1' })
      .expect(201)
      .expect({ id: 'session-1', status: 'recording' }));

  it('accepts realtime samples', () =>
    request(app.getHttpServer())
      .post(`/${API_PREFIX}/sessions/session-1/data`)
      .send({ data: { pressure: { left: [1, 2, 3] } }, sequence: 1 })
      .expect(202)
      .expect({ sessionId: 'session-1', accepted: 1 }));

  it('accepts the frontend multipart NDJSON contract', () =>
    request(app.getHttpServer())
      .post(`/${API_PREFIX}/sessions/sync-batch`)
      .field('session_id', 'mobile-1')
      .field('device_type', 'android')
      .attach('file', Buffer.from('{"sequence":1,"pressure":42}\n'), {
        filename: 'mobile-1.jsonl',
        contentType: 'application/x-ndjson',
      })
      .expect(202)
      .expect({ sessionId: 'session-1', clientSessionUuid: 'mobile-1', accepted: 1 }));

  it('finishes and returns frontend history fields', () =>
    request(app.getHttpServer())
      .post(`/${API_PREFIX}/sessions/session-1/finish`)
      .send({ steps: 100, duration: 5, distance: '0.25', calories: 20, peakLeft: 'heel' })
      .expect(201)
      .expect({ id: 'session-1', status: 'processing', steps: 100 }));

  it('lists and gets sessions', async () => {
    await request(app.getHttpServer()).get(`/${API_PREFIX}/sessions`).expect(200).expect({ items: [], nextCursor: null });
    await request(app.getHttpServer()).get(`/${API_PREFIX}/sessions/session-1`).expect(200).expect({ id: 'session-1', steps: 100 });
  });

  it('returns pressure, gait, and insight data', async () => {
    await request(app.getHttpServer())
      .get(`/${API_PREFIX}/sessions/session-1/pressure-map`)
      .expect(200)
      .expect({ maps: [], zones: [], balance: { left: 50, right: 50 } });
    await request(app.getHttpServer()).get(`/${API_PREFIX}/sessions/session-1/gait-analysis`).expect(200);
    await request(app.getHttpServer()).get(`/${API_PREFIX}/sessions/session-1/insight`).expect(200).expect([]);
  });
});
