import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { authenticatedRequest as request } from "./authenticated-request";

jest.mock("sanitize-html", () => jest.fn((input) => input));

import { AppModule } from "../src/app.module";
import { HealthService } from "../src/modules/health/health.service";
import { API_PREFIX, PrismaService } from "@blansole/shared";

describe("Health Integration Controller (e2e)", () => {
  let app: INestApplication;
  const service = {
    list: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue({
      id: "health-1",
      provider: "apple_health",
      status: "connected",
    }),
    sync: jest.fn().mockResolvedValue({
      syncLogId: "sync-1",
      status: "queued",
      recordsQueued: 1,
    }),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(HealthService)
      .useValue(service)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(() => app.close());

  it("connects, queues mobile summaries, and disconnects an owned integration", async () => {
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/health-integrations/connect`)
      .send({ provider: "apple_health" })
      .expect(201)
      .expect({
        id: "health-1",
        provider: "apple_health",
        status: "connected",
      });
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/health-integrations/sync`)
      .send({
        integrationId: "health-1",
        summaries: [{ date: "2026-07-20", steps: 8_000 }],
      })
      .expect(202)
      .expect({ syncLogId: "sync-1", status: "queued", recordsQueued: 1 });
    await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/health-integrations/health-1`)
      .expect(204);
  });
});
