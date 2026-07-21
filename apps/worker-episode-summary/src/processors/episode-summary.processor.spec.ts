import { EpisodeSummaryProcessor } from "./episode-summary.processor";

describe("EpisodeSummaryProcessor", () => {
  it("upserts an idempotent deterministic weekly aggregate", async () => {
    const prisma = {
      activitySession: {
        findMany: jest.fn().mockResolvedValue([
          {
            durationSec: 1_800,
            metrics: { steps: 4_000, distanceKm: 3.2, calories: 120 },
          },
        ]),
      },
      aiChatMessage: { count: jest.fn().mockResolvedValue(2) },
      episodeSummary: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const processor = new EpisodeSummaryProcessor(prisma as any);

    await processor.process({
      data: {
        userId: "user-1",
        periodType: "weekly",
        periodStart: "2026-07-13T00:00:00.000Z",
        periodEnd: "2026-07-20T00:00:00.000Z",
      },
    } as any);

    expect(prisma.episodeSummary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_periodType_periodStart_periodEnd: expect.objectContaining({
            userId: "user-1",
          }),
        },
        create: expect.objectContaining({
          algorithmVersion: "deterministic-aggregate-v1",
          keyMetricsJson: expect.objectContaining({
            sessions: 1,
            steps: 4_000,
            chatMessages: 2,
          }),
        }),
      }),
    );
  });
});
