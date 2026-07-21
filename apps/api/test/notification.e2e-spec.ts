import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { authenticatedRequest as request } from "./authenticated-request";

jest.mock("sanitize-html", () => jest.fn((input) => input));

import { AppModule } from "../src/app.module";
import { NotificationService } from "../src/modules/notification/notification.service";
import { API_PREFIX, PrismaService } from "@blansole/shared";

describe("Notification Controllers (e2e)", () => {
  let app: INestApplication;
  const service = {
    list: jest.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
    markRead: jest.fn().mockResolvedValue({ updated: 2 }),
    getSettings: jest.fn().mockResolvedValue([]),
    updateSettings: jest
      .fn()
      .mockResolvedValue([{ channel: "push", category: "all", enabled: true }]),
    listPushDevices: jest.fn().mockResolvedValue([]),
    registerPushDevice: jest.fn().mockResolvedValue({
      id: "push-1",
      provider: "expo",
      platform: "android",
      active: true,
      tokenSuffix: "12345678",
    }),
    removePushDevice: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(NotificationService)
      .useValue(service)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(() => app.close());

  it("lists notifications and unread count", () =>
    request(app.getHttpServer())
      .get(`/${API_PREFIX}/notifications`)
      .expect(200)
      .expect({ items: [], unreadCount: 0 }));

  it("marks only the requested notifications read", () =>
    request(app.getHttpServer())
      .post(`/${API_PREFIX}/notifications/read`)
      .send({ notificationIds: ["1", "2"] })
      .expect(201)
      .expect({ updated: 2 }));

  it("reads and updates notification preferences", async () => {
    await request(app.getHttpServer())
      .get(`/${API_PREFIX}/notification-settings`)
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .put(`/${API_PREFIX}/notification-settings`)
      .send({ pushEnabled: true })
      .expect(200)
      .expect([{ channel: "push", category: "all", enabled: true }]);
  });

  it("registers and removes a push device without returning the full token", async () => {
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/notification-devices`)
      .send({
        token: "ExponentPushToken[abcdef12345678]",
        provider: "expo",
        platform: "android",
      })
      .expect(201)
      .expect({
        id: "push-1",
        provider: "expo",
        platform: "android",
        active: true,
        tokenSuffix: "12345678",
      });
    await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/notification-devices/push-1`)
      .expect(204);
  });
});
