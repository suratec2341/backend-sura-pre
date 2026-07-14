import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import { API_PREFIX } from '@blansole/shared';
import { HealthCheckController } from '../src/health-check.controller';

describe('Health check (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthCheckController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX, { exclude: ['healthz'] });

    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /healthz returns ok outside the API prefix', async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(Date.parse(body.timestamp)).not.toBeNaN();
  });
});
