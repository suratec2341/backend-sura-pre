import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@blansole/shared';
import {
  UpdateConsentDto,
  UpdateGoalDto,
  UpdateProfileDto,
  UpdateSettingsDto,
} from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: { not: 'deleted' } },
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
        profile: true,
        healthNotes: { orderBy: { reportedAt: 'desc' }, take: 1 },
        goals: { where: { status: 'active' }, orderBy: { startDate: 'desc' } },
        settings: true,
        consents: { orderBy: { grantedAt: 'desc' } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      profile: this.mapProfile(user.profile),
      health: user.healthNotes[0] ?? null,
      goals: user.goals,
      settings: user.settings,
      consents: user.consents,
      onboardingComplete: Boolean(user.profile?.name),
    };
  }

  async updateProfile(userId: string, body: UpdateProfileDto) {
    await this.assertUser(userId);
    const profileData = this.profileData(body);
    const healthData = this.healthData(body);

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(profileData).length) {
        await tx.userProfile.upsert({
          where: { userId },
          create: { userId, ...profileData },
          update: profileData,
        });
      }
      if (healthData) {
        await tx.userHealthNote.create({ data: { userId, ...healthData } });
      }
    });

    return this.getMe(userId);
  }

  async getGoals(userId: string) {
    await this.assertUser(userId);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [items, metrics, sessions] = await Promise.all([
      this.prisma.userGoal.findMany({
        where: { userId, status: 'active' },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.sessionMetric.aggregate({
        where: { session: { userId, startedAt: { gte: startOfToday } } },
        _sum: { steps: true, distanceKm: true, calories: true },
      }),
      this.prisma.activitySession.aggregate({
        where: { userId, startedAt: { gte: startOfToday } },
        _sum: { durationSec: true },
      }),
    ]);

    return {
      items,
      dailyProgress: {
        steps: metrics._sum.steps ?? 0,
        distance: metrics._sum.distanceKm ?? 0,
        calories: metrics._sum.calories ?? 0,
        duration: sessions._sum.durationSec ?? 0,
      },
    };
  }

  async updateGoal(userId: string, body: UpdateGoalDto) {
    await this.assertUser(userId);
    const goalType = (body.goalType ?? body.goal)?.trim();
    if (!goalType) throw new BadRequestException('goal or goalType is required');
    const targetValue = body.targetValue ?? body.targetSteps;

    const existing = await this.prisma.userGoal.findFirst({
      where: { userId, goalType, status: 'active' },
      orderBy: { startDate: 'desc' },
    });
    const updateData = {
      targetValue,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    };

    if (existing) {
      return this.prisma.userGoal.update({ where: { id: existing.id }, data: updateData });
    }
    return this.prisma.userGoal.create({
      data: {
        userId,
        goalType,
        ...updateData,
        startDate: updateData.startDate ?? new Date(),
      },
    });
  }

  async getSettings(userId: string) {
    await this.assertUser(userId);
    return this.prisma.userSetting.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updateSettings(userId: string, body: UpdateSettingsDto) {
    await this.assertUser(userId);
    return this.prisma.userSetting.upsert({
      where: { userId },
      create: { userId, ...body },
      update: body,
    });
  }

  async getConsents(userId: string) {
    await this.assertUser(userId);
    return this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async updateConsent(userId: string, type: string, body: UpdateConsentDto) {
    await this.assertUser(userId);
    const consentType = type.trim();
    if (!consentType) throw new BadRequestException('Consent type is required');

    return this.prisma.$transaction(async (tx) => {
      await tx.userConsent.updateMany({
        where: { userId, consentType, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!body.granted) return { consentType, granted: false };

      const consent = await tx.userConsent.create({
        data: { userId, consentType, version: body.version },
      });
      return { ...consent, granted: true };
    });
  }

  async getHealth(userId: string) {
    await this.assertUser(userId);
    return this.prisma.userHealthNote.findMany({
      where: { userId },
      orderBy: { reportedAt: 'desc' },
      take: 50,
    });
  }

  async updateHealth(userId: string, body: UpdateProfileDto) {
    await this.assertUser(userId);
    const data = this.healthData(body);
    if (!data) throw new BadRequestException('At least one health field is required');
    return this.prisma.userHealthNote.create({ data: { userId, ...data } });
  }

  async getRisks(userId: string, scope?: string) {
    await this.assertUser(userId);
    const rows = await this.prisma.riskAssessment.findMany({
      where: { userId, ...(scope ? { scope } : {}) },
      orderBy: { computedAt: 'desc' },
      take: 100,
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latest.has(row.assessmentType)) latest.set(row.assessmentType, row);
    }
    return { items: rows, latest: Object.fromEntries(latest) };
  }

  private async assertUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: { not: 'deleted' } },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
  }

  private profileData(body: UpdateProfileDto): Omit<Prisma.UserProfileUncheckedCreateInput, 'userId'> {
    const data: Omit<Prisma.UserProfileUncheckedCreateInput, 'userId'> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.birthday !== undefined) data.birthday = this.parseBirthday(body.birthday);
    if (body.gender !== undefined) data.gender = body.gender;
    if (body.weight !== undefined) data.weightKg = body.weight;
    if (body.height !== undefined) data.heightCm = body.height;
    if (body.activityLevel !== undefined) data.activityLevel = body.activityLevel;
    if (body.exerciseFrequency !== undefined) data.exerciseFrequency = body.exerciseFrequency;
    if (body.sedentaryHoursPerDay !== undefined) data.sedentaryHoursPerDay = body.sedentaryHoursPerDay;
    if (body.shoeType !== undefined) data.primaryFootwear = body.shoeType;
    if (body.footSizeLeft !== undefined) data.footSizeLeft = body.footSizeLeft;
    if (body.footSizeRight !== undefined) data.footSizeRight = body.footSizeRight;
    return data;
  }

  private healthData(body: UpdateProfileDto): Omit<Prisma.UserHealthNoteUncheckedCreateInput, 'userId'> | null {
    const hasHealth = body.conditions !== undefined
      || body.injuryHistory !== undefined
      || body.currentMedications !== undefined
      || body.painLevel !== undefined
      || body.painPoints !== undefined;
    if (!hasHealth) return null;

    return {
      conditionNote: body.conditions?.join(', '),
      medicalConditions: body.conditions as Prisma.InputJsonValue | undefined,
      injuryHistory: body.injuryHistory,
      currentMedications: body.currentMedications as Prisma.InputJsonValue | undefined,
      painArea: body.painPoints?.join(', '),
      painLevel: body.painLevel,
      painPoints: body.painPoints as Prisma.InputJsonValue | undefined,
    };
  }

  private mapProfile(profile: {
    userId: string;
    name: string | null;
    birthday: Date | null;
    gender: string | null;
    weightKg: number | null;
    heightCm: number | null;
    activityLevel: string | null;
    exerciseFrequency: string | null;
    sedentaryHoursPerDay: number | null;
    primaryFootwear: string | null;
    footSizeLeft: number | null;
    footSizeRight: number | null;
    updatedAt: Date;
  } | null) {
    if (!profile) return null;
    return {
      ...profile,
      birthday: profile.birthday?.toISOString().slice(0, 10) ?? null,
      age: profile.birthday ? this.calculateAge(profile.birthday) : null,
      weight: profile.weightKg,
      height: profile.heightCm,
      shoeType: profile.primaryFootwear,
    };
  }

  private parseBirthday(value: string) {
    const parts = value.includes('-')
      ? value.split('-').map(Number)
      : value.split('/').map(Number).reverse();
    const [year, month, day] = parts;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new BadRequestException('birthday is invalid');
    }
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    if (date.getTime() > todayUtc || today.getUTCFullYear() - year > 150) {
      throw new BadRequestException('birthday must be a valid date in the past');
    }
    return date;
  }

  private calculateAge(birthday: Date, today = new Date()) {
    let age = today.getUTCFullYear() - birthday.getUTCFullYear();
    const birthdayHasPassed = today.getUTCMonth() > birthday.getUTCMonth()
      || (today.getUTCMonth() === birthday.getUTCMonth() && today.getUTCDate() >= birthday.getUTCDate());
    if (!birthdayHasPassed) age -= 1;
    return Math.max(0, age);
  }
}
