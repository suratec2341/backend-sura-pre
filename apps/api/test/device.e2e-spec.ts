import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { authenticatedRequest as request } from './authenticated-request';

jest.mock('sanitize-html', () => jest.fn((input) => input));

import { AppModule } from '../src/app.module';
import { DeviceService } from '../src/modules/device/device.service';
import { API_PREFIX, PrismaService } from '@blansole/shared';

describe('Device Controller (e2e)', () => {
  let app: INestApplication;
  const service = {
    list: jest.fn().mockResolvedValue([]),
    pair: jest.fn().mockResolvedValue({ id: 'device-1', deviceSerial: 'SOLE-001' }),
    update: jest.fn().mockResolvedValue({ id: 'device-1', autoReconnect: false }),
    remove: jest.fn().mockResolvedValue(undefined),
    sync: jest.fn().mockResolvedValue({ id: 'sync-1', status: 'completed' }),
    status: jest.fn().mockResolvedValue({ id: 'device-1', connected: true, batteryLeft: 80, batteryRight: 82 }),
    logBattery: jest.fn().mockResolvedValue({ id: 'battery-1', batteryLeft: 80 }),
    calibrate: jest.fn().mockResolvedValue({ id: 'calibration-1', footSizeLeft: 42 }),
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(DeviceService)
      .useValue(service)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(() => app.close());

  it('lists devices', () => request(app.getHttpServer()).get(`/${API_PREFIX}/devices`).expect(200).expect([]));

  it('pairs a device', () =>
    request(app.getHttpServer())
      .post(`/${API_PREFIX}/devices/pair`)
      .send({ deviceSerial: 'SOLE-001', deviceModel: 'BL-1', hardwareVersion: '1.0' })
      .expect(201)
      .expect({ id: 'device-1', deviceSerial: 'SOLE-001' }));

  it('updates and unpairs an owned device', async () => {
    await request(app.getHttpServer()).put(`/${API_PREFIX}/devices/device-1`).send({ autoReconnect: false }).expect(200);
    await request(app.getHttpServer()).delete(`/${API_PREFIX}/devices/device-1`).expect(204);
  });

  it('syncs and returns live status', async () => {
    await request(app.getHttpServer()).post(`/${API_PREFIX}/devices/device-1/sync`).send({ steps: 100 }).expect(201);
    await request(app.getHttpServer())
      .get(`/${API_PREFIX}/devices/device-1/status`)
      .expect(200)
      .expect({ id: 'device-1', connected: true, batteryLeft: 80, batteryRight: 82 });
  });

  it('records battery and calibration values', async () => {
    await request(app.getHttpServer()).post(`/${API_PREFIX}/devices/device-1/battery`).send({ batteryLeft: 80 }).expect(201);
    await request(app.getHttpServer()).post(`/${API_PREFIX}/devices/device-1/calibrate`).send({ footSizeLeft: 42 }).expect(201);
  });
});
