import { UserService } from "./user.service";

describe("UserService", () => {
  it("persists profile aliases and health assessment fields from onboarding", async () => {
    const fullUser = {
      id: "user-1",
      email: "user@example.com",
      status: "active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      profile: {
        userId: "user-1",
        name: "Somchai",
        birthday: new Date("1994-07-20T00:00:00.000Z"),
        gender: "male",
        weightKg: 70,
        heightCm: 175,
        activityLevel: "moderate",
        exerciseFrequency: "3-4_per_week",
        sedentaryHoursPerDay: null,
        primaryFootwear: "running",
        footSizeLeft: 42,
        footSizeRight: 42.5,
        updatedAt: new Date(),
      },
      healthNotes: [],
      goals: [],
      settings: null,
      consents: [],
    };
    const tx = {
      userProfile: { upsert: jest.fn().mockResolvedValue({}) },
      userHealthNote: { create: jest.fn().mockResolvedValue({}) },
      userGoal: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      user: {
        findFirst: jest
          .fn()
          .mockImplementation((query) =>
            query.select && Object.keys(query.select).length === 1
              ? { id: "user-1" }
              : fullUser,
          ),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new UserService(prisma as any);

    const result = await service.updateProfile("user-1", {
      name: "Somchai",
      birthDate: "20/07/1994",
      age: 31,
      weight: 70,
      height: 175,
      exerciseFrequency: "3-4_per_week",
      shoeType: "running",
      footSizeLeft: 42,
      footSizeRight: 42.5,
      conditions: ["diabetes"],
      currentMedications: ["metformin"],
      painLevel: 3,
      painPoints: ["right_heel"],
      goal: "Health & Wellness",
    });

    expect(tx.userProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user-1",
          weightKg: 70,
          heightCm: 175,
          primaryFootwear: "running",
          birthday: new Date("1994-07-20T00:00:00.000Z"),
        }),
      }),
    );
    expect(tx.userProfile.upsert.mock.calls[0][0].create).not.toHaveProperty(
      "age",
    );
    expect(tx.userHealthNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        painLevel: 3,
        medicalConditions: ["diabetes"],
      }),
    });
    expect(tx.userGoal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        goalType: "Health & Wellness",
      }),
    });
    expect(result.profile).toEqual(
      expect.objectContaining({
        birthday: "1994-07-20",
        age: expect.any(Number),
        weight: 70,
        height: 175,
        shoeType: "running",
      }),
    );
  });
});
