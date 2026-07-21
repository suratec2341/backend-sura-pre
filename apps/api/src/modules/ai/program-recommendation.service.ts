import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@blansole/shared";
import { RecommendProgramDto } from "./dto/ai.dto";

@Injectable()
export class ProgramRecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async recommend(userId: string, body: RecommendProgramDto) {
    const [health, risk, goals, session] = await Promise.all([
      this.prisma.userHealthNote.findFirst({
        where: { userId },
        orderBy: { reportedAt: "desc" },
      }),
      this.prisma.riskAssessment.findFirst({
        where: { userId },
        orderBy: { computedAt: "desc" },
      }),
      this.prisma.userGoal.findMany({ where: { userId, status: "active" } }),
      this.prisma.activitySession.findFirst({
        where: { userId, ...(body.sessionId ? { id: body.sessionId } : {}) },
        orderBy: { startedAt: "desc" },
        include: { pressureZones: true, metrics: true },
      }),
    ]);
    if (body.sessionId && !session)
      throw new NotFoundException("Activity session not found");

    const tags = new Set<string>();
    for (const value of body.conditionTags ?? []) this.addTag(tags, value);
    for (const value of this.jsonStrings(health?.medicalConditions))
      this.addTag(tags, value);
    for (const value of this.jsonStrings(health?.painPoints))
      this.addTag(tags, value);
    for (const goal of goals) this.addTag(tags, goal.goalType);
    if (risk) {
      this.addTag(tags, risk.assessmentType);
      this.addTag(tags, `${risk.assessmentType}_${risk.riskLevel}`);
    }
    for (const zone of session?.pressureZones ?? []) {
      if (!zone.hotspotArea) continue;
      this.addTag(tags, zone.hotspotArea);
      this.addTag(tags, `${zone.hotspotArea}_pressure`);
      this.addTag(tags, `${zone.footSide}_${zone.hotspotArea}`);
    }

    const severity = body.severity ?? risk?.score;
    const normalizedTags = [...tags];
    const rules = normalizedTags.length
      ? await this.prisma.programRecommendationRule.findMany({
          where: {
            conditionTag: { in: normalizedTags },
            program: { status: "published" },
          },
          include: {
            program: {
              include: {
                tags: { include: { tag: true } },
                videos: {
                  where: { status: "published", linkStatus: "active" },
                  orderBy: { orderIndex: "asc" },
                },
              },
            },
          },
          orderBy: [{ priority: "desc" }, { conditionTag: "asc" }],
        })
      : [];
    const matchedRule = rules.find((rule) =>
      this.inSeverityRange(severity, rule.severityMin, rule.severityMax),
    );
    if (!matchedRule || !matchedRule.program.videos.length) {
      return {
        matched: false,
        evaluatedTags: normalizedTags,
        severity: severity ?? null,
        reason: "No published program matched the deterministic rules",
      };
    }

    const recommendationText = `Matched published program "${matchedRule.program.title}" for ${matchedRule.conditionTag}.`;
    const [recommendation, assignment] = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.aiRecommendation.create({
          data: {
            userId,
            sessionId: session?.id,
            recommendationText,
            category: "exercise",
            modelVersion: "deterministic-rules-v1",
          },
        });
        if (!body.assign) return [created, null] as const;
        const existing = await tx.userProgramAssignment.findFirst({
          where: {
            userId,
            programId: matchedRule.program.id,
            status: "in_progress",
          },
        });
        const assigned =
          existing ??
          (await tx.userProgramAssignment.create({
            data: {
              userId,
              programId: matchedRule.program.id,
              source: "ai_chat",
            },
          }));
        return [created, assigned] as const;
      },
    );

    return {
      matched: true,
      matchedTag: matchedRule.conditionTag,
      severity: severity ?? null,
      recommendation,
      assignment,
      program: matchedRule.program,
    };
  }

  private inSeverityRange(
    value: number | undefined,
    minimum: number | null,
    maximum: number | null,
  ) {
    if (value === undefined) return minimum === null && maximum === null;
    return (
      (minimum === null || value >= minimum) &&
      (maximum === null || value <= maximum)
    );
  }

  private jsonStrings(value: unknown): string[] {
    if (Array.isArray(value))
      return value.filter((item): item is string => typeof item === "string");
    return typeof value === "string" ? [value] : [];
  }

  private addTag(target: Set<string>, value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (normalized) target.add(normalized);
  }
}
