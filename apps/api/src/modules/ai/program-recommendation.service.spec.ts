import { ProgramRecommendationService } from "./program-recommendation.service";

describe("ProgramRecommendationService", () => {
  it("matches only a published program through deterministic rules", async () => {
    const tx = {
      aiRecommendation: {
        create: jest.fn().mockResolvedValue({ id: "recommendation-1" }),
      },
      userProgramAssignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "assignment-1" }),
      },
    };
    const program = {
      id: "program-1",
      title: "Heel load basics",
      videos: [{ id: "video-1", status: "published", linkStatus: "active" }],
      tags: [],
    };
    const prisma = {
      userHealthNote: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ medicalConditions: [], painPoints: ["heel"] }),
      },
      riskAssessment: { findFirst: jest.fn().mockResolvedValue(null) },
      userGoal: { findMany: jest.fn().mockResolvedValue([]) },
      activitySession: { findFirst: jest.fn().mockResolvedValue(null) },
      programRecommendationRule: {
        findMany: jest.fn().mockResolvedValue([
          {
            conditionTag: "heel",
            severityMin: null,
            severityMax: null,
            program,
          },
        ]),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new ProgramRecommendationService(prisma as any);

    const result = await service.recommend("user-1", { assign: true });

    expect(result).toEqual(
      expect.objectContaining({ matched: true, matchedTag: "heel", program }),
    );
    expect(tx.aiRecommendation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        modelVersion: "deterministic-rules-v1",
      }),
    });
    expect(tx.userProgramAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        programId: "program-1",
      }),
    });
  });

  it("returns no match instead of inventing content", async () => {
    const prisma = {
      userHealthNote: { findFirst: jest.fn().mockResolvedValue(null) },
      riskAssessment: { findFirst: jest.fn().mockResolvedValue(null) },
      userGoal: { findMany: jest.fn().mockResolvedValue([]) },
      activitySession: { findFirst: jest.fn().mockResolvedValue(null) },
      programRecommendationRule: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new ProgramRecommendationService(prisma as any);

    await expect(service.recommend("user-1", {})).resolves.toEqual(
      expect.objectContaining({
        matched: false,
        reason: expect.stringContaining("No published program"),
      }),
    );
  });
});
