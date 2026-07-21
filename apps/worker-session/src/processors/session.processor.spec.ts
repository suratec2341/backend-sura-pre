import { SessionProcessor } from "./session.processor";

describe("SessionProcessor", () => {
  it("keeps client metrics, derives missing counters, and completes the session", async () => {
    const tx = {
      sessionMetric: { upsert: jest.fn().mockResolvedValue({}) },
      sessionGaitMetric: { upsert: jest.fn().mockResolvedValue({}) },
      sessionPressureZone: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      notificationEvent: { create: jest.fn().mockResolvedValue({}) },
      activitySession: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      activitySession: {
        findUnique: jest.fn().mockResolvedValue({
          id: "session-1",
          userId: "user-1",
          status: "processing",
          startedAt: new Date("2026-07-20T10:00:00.000Z"),
          endedAt: new Date("2026-07-20T10:05:00.000Z"),
          durationSec: 300,
          metrics: { steps: 100, distanceKm: null, calories: null },
          sensorSamples: [
            {
              recordedAt: new Date("2026-07-20T10:00:01.000Z"),
              payload: { liveData: { steps: 10, distance: 0.1 } },
            },
            {
              recordedAt: new Date("2026-07-20T10:04:59.000Z"),
              payload: {
                liveData: { steps: 95, distance: "0.5", calories: 20 },
              },
            },
          ],
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const processor = new SessionProcessor(prisma as any);

    await processor.process({ data: { sessionId: "session-1" } } as any);

    expect(tx.sessionMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          steps: 100,
          distanceKm: 0.5,
          calories: 20,
          cadence: 20,
        }),
      }),
    );
    expect(tx.activitySession.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: expect.objectContaining({ status: "completed", durationSec: 300 }),
    });
  });

  it("computes relative pressure zones without inventing a clinical risk score", async () => {
    const tx = {
      sessionMetric: { upsert: jest.fn() },
      sessionGaitMetric: { upsert: jest.fn() },
      sessionPressureZone: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      notificationEvent: { create: jest.fn().mockResolvedValue({}) },
      activitySession: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      activitySession: {
        findUnique: jest.fn().mockResolvedValue({
          id: "session-2",
          userId: "user-1",
          status: "processing",
          startedAt: new Date("2026-07-20T10:00:00.000Z"),
          endedAt: new Date("2026-07-20T10:01:00.000Z"),
          durationSec: 60,
          metrics: null,
          sensorSamples: [
            {
              recordedAt: new Date("2026-07-20T10:00:01.000Z"),
              payload: {
                pressure: {
                  left: {
                    toe: 10,
                    forefoot: 20,
                    midInner: 5,
                    midOuter: 5,
                    heel: 60,
                  },
                  right: {
                    toe: 10,
                    forefoot: 30,
                    midInner: 10,
                    midOuter: 10,
                    heel: 40,
                  },
                },
              },
            },
          ],
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const processor = new SessionProcessor(prisma as any);

    await processor.process({ data: { sessionId: "session-2" } } as any);

    expect(tx.sessionPressureZone.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          footSide: "left",
          heelPercent: 60,
          pressureLevel: "unclassified",
        }),
        expect.objectContaining({
          footSide: "right",
          forefootPercent: 40,
          pressureLevel: "unclassified",
        }),
      ]),
    });
    expect(prisma).not.toHaveProperty("riskAssessment");
  });

  it("processes a maximum-size 20,000-sample batch within the worker budget", async () => {
    const tx = {
      sessionMetric: { upsert: jest.fn().mockResolvedValue({}) },
      sessionGaitMetric: { upsert: jest.fn().mockResolvedValue({}) },
      sessionPressureZone: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      notificationEvent: { create: jest.fn().mockResolvedValue({}) },
      activitySession: { update: jest.fn().mockResolvedValue({}) },
    };
    const startedAt = new Date("2026-07-20T10:00:00.000Z");
    const sensorSamples = Array.from({ length: 20_000 }, (_, sequence) => ({
      recordedAt: new Date(startedAt.getTime() + sequence),
      payload: { liveData: { steps: sequence, distanceKm: sequence / 10_000 } },
    }));
    const prisma = {
      activitySession: {
        findUnique: jest.fn().mockResolvedValue({
          id: "session-large",
          userId: "user-1",
          status: "processing",
          startedAt,
          endedAt: sensorSamples.at(-1)?.recordedAt,
          durationSec: 20,
          metrics: null,
          sensorSamples,
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const processor = new SessionProcessor(prisma as any);

    const before = performance.now();
    await processor.process({ data: { sessionId: "session-large" } } as any);
    const elapsedMs = performance.now() - before;

    expect(elapsedMs).toBeLessThan(5_000);
    expect(tx.sessionMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ steps: 19_999, distanceKm: 1.9999 }),
      }),
    );
  });
});
