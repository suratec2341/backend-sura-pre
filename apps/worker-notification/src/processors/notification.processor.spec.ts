import { ConfigService } from "@nestjs/config";
import { NotificationProcessor } from "./notification.processor";

describe("NotificationProcessor", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("turns an outbox event into one in-app notification and marks it processed", async () => {
    const prisma = {
      notificationEvent: {
        findUnique: jest.fn().mockResolvedValue({
          id: "event-1",
          userId: "user-1",
          eventType: "session_completed",
          payloadJson: { steps: 8_000 },
          processedAt: null,
          notification: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      notificationRule: { findFirst: jest.fn().mockResolvedValue(null) },
      notification: {
        create: jest.fn().mockResolvedValue({ id: "notification-1" }),
      },
      notificationPreference: { findMany: jest.fn().mockResolvedValue([]) },
      pushRegistration: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const processor = new NotificationProcessor(
      prisma as any,
      new ConfigService({}),
    );

    await processor.process({
      name: "event",
      data: { eventId: "event-1" },
    } as any);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceEventId: "event-1",
        category: "activity",
        status: "sent",
      }),
    });
    expect(prisma.notificationEvent.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: expect.objectContaining({
        processedAt: expect.any(Date),
        processingError: null,
      }),
    });
  });

  it("lets a category preference override the global push preference", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { status: "ok", id: "expo-ticket-1" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const prisma = {
      notificationEvent: {
        findUnique: jest.fn().mockResolvedValue({
          id: "event-2",
          userId: "user-1",
          eventType: "session_completed",
          payloadJson: {},
          processedAt: null,
          notification: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      notificationRule: { findFirst: jest.fn().mockResolvedValue(null) },
      notification: {
        create: jest.fn().mockResolvedValue({ id: "notification-2" }),
      },
      notificationPreference: {
        findMany: jest.fn().mockResolvedValue([
          { category: "all", enabled: false },
          { category: "activity", enabled: true },
        ]),
      },
      pushRegistration: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "device-1",
            provider: "expo",
            token: "ExpoPushToken[valid_token]",
          },
        ]),
      },
      notificationDeliveryLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const processor = new NotificationProcessor(
      prisma as any,
      new ConfigService({}),
    );

    await processor.process({
      name: "event",
      data: { eventId: "event-2" },
    } as any);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(prisma.notificationDeliveryLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notificationId: "notification-2",
        providerMessageId: "expo-ticket-1",
        status: "accepted",
      }),
    });
  });
});
