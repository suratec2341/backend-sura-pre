import { HealthSyncProcessor } from "./health-sync.processor";

describe("HealthSyncProcessor", () => {
  it("upserts mobile health summaries and completes the sync log", async () => {
    const tx = {
      healthDailySummary: { upsert: jest.fn().mockResolvedValue({}) },
      healthSyncLog: { update: jest.fn().mockResolvedValue({}) },
      notificationEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      healthIntegration: {
        findFirst: jest.fn().mockResolvedValue({ id: "integration-1" }),
      },
      healthSyncLog: { updateMany: jest.fn() },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const processor = new HealthSyncProcessor(prisma as any);

    await processor.process({
      data: {
        syncLogId: "sync-1",
        integrationId: "integration-1",
        userId: "user-1",
        summaries: [{ date: "2026-07-20", steps: 8_000, distanceKm: 6.2 }],
      },
    } as any);

    expect(tx.healthDailySummary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_date: {
            userId: "user-1",
            date: new Date("2026-07-20T00:00:00.000Z"),
          },
        },
        create: expect.objectContaining({ userId: "user-1", steps: 8_000 }),
      }),
    );
    expect(tx.healthSyncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sync-1" },
        data: expect.objectContaining({
          status: "completed",
          recordsSynced: 1,
        }),
      }),
    );
  });
});
