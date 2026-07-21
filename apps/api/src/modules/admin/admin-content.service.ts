import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "@blansole/shared";
import { Prisma } from "@prisma/client";
import {
  CreateProgramDto,
  CreateRecommendationRuleDto,
  CreateTagDto,
  CreateVideoDto,
  ProgramListQueryDto,
  UpdateProgramDto,
  UpdateVideoDto,
} from "./dto/admin-content.dto";

interface YoutubeMetadata {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  linkStatus: "active" | "broken" | "private" | "removed";
}

@Injectable()
export class AdminContentService {
  constructor(private readonly prisma: PrismaService) {}

  listPrograms(query: ProgramListQueryDto) {
    return this.prisma.exerciseProgram.findMany({
      where: query.status ? { status: query.status } : undefined,
      include: {
        tags: { include: { tag: true } },
        videos: { orderBy: { orderIndex: "asc" } },
        _count: { select: { assignments: true, recommendationRules: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createProgram(staffId: string, body: CreateProgramDto) {
    return this.prisma.$transaction(async (tx) => {
      const tagIds = await this.resolveTagIds(tx, body.tagNames);
      const program = await tx.exerciseProgram.create({
        data: {
          title: body.title.trim(),
          description: body.description?.trim(),
          durationWeeks: body.durationWeeks,
          difficulty: body.difficulty,
          version: body.version?.trim() || "1.0",
          createdBy: staffId,
        },
      });
      if (tagIds.length) {
        await tx.programTag.createMany({
          data: tagIds.map((tagId) => ({ programId: program.id, tagId })),
        });
      }
      await this.audit(tx, staffId, "create_program", program.id, { tagIds });
      return program;
    });
  }

  async updateProgram(staffId: string, id: string, body: UpdateProgramDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.exerciseProgram.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Exercise program not found");
      if (current.status === "published") {
        throw new BadRequestException(
          "Unpublish the program before editing it",
        );
      }

      const data: Prisma.ExerciseProgramUpdateInput = {
        title: body.title?.trim(),
        description: body.description?.trim(),
        durationWeeks: body.durationWeeks,
        difficulty: body.difficulty,
        version: body.version?.trim(),
      };
      const updated = await tx.exerciseProgram.update({ where: { id }, data });
      if (body.tagNames) {
        const tagIds = await this.resolveTagIds(tx, body.tagNames);
        await tx.programTag.deleteMany({ where: { programId: id } });
        if (tagIds.length) {
          await tx.programTag.createMany({
            data: tagIds.map((tagId) => ({ programId: id, tagId })),
          });
        }
      }
      await this.audit(
        tx,
        staffId,
        "update_program",
        id,
        body as Prisma.InputJsonValue,
      );
      return updated;
    });
  }

  async submitReview(staffId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const program = await tx.exerciseProgram.findUnique({
        where: { id },
        include: { videos: true },
      });
      if (!program) throw new NotFoundException("Exercise program not found");
      if (program.status !== "draft")
        throw new BadRequestException("Only draft programs can be submitted");
      if (!program.videos.length)
        throw new BadRequestException(
          "A program needs at least one video before review",
        );
      if (program.videos.some((video) => !video.aiDescription?.trim())) {
        throw new BadRequestException(
          "Every video needs an AI grounding description",
        );
      }

      const updated = await tx.exerciseProgram.update({
        where: { id },
        data: { status: "in_review" },
      });
      await tx.exerciseVideo.updateMany({
        where: { programId: id, status: "draft" },
        data: { status: "in_review" },
      });
      await tx.contentReviewLog.create({
        data: {
          contentId: id,
          contentType: "program",
          reviewerId: staffId,
          action: "submitted_review",
        },
      });
      return updated;
    });
  }

  async publish(staffId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const program = await tx.exerciseProgram.findUnique({
        where: { id },
        include: { videos: true },
      });
      if (!program) throw new NotFoundException("Exercise program not found");
      if (program.status !== "in_review")
        throw new BadRequestException(
          "Program must be in review before publish",
        );
      if (
        !program.videos.length ||
        program.videos.some((video) => video.linkStatus !== "active")
      ) {
        throw new BadRequestException(
          "All program videos must have active verified links",
        );
      }

      const publishedAt = new Date();
      const updated = await tx.exerciseProgram.update({
        where: { id },
        data: { status: "published", publishedAt },
      });
      await tx.exerciseVideo.updateMany({
        where: { programId: id },
        data: { status: "published", reviewedBy: staffId, publishedAt },
      });
      await tx.contentReviewLog.create({
        data: {
          contentId: id,
          contentType: "program",
          reviewerId: staffId,
          action: "approved",
        },
      });
      await this.audit(tx, staffId, "publish_program", id);
      return updated;
    });
  }

  async unpublish(staffId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const program = await tx.exerciseProgram.findUnique({ where: { id } });
      if (!program) throw new NotFoundException("Exercise program not found");
      if (program.status !== "published")
        throw new BadRequestException("Program is not published");
      const updated = await tx.exerciseProgram.update({
        where: { id },
        data: { status: "archived" },
      });
      await tx.exerciseVideo.updateMany({
        where: { programId: id },
        data: { status: "archived" },
      });
      await tx.contentReviewLog.create({
        data: {
          contentId: id,
          contentType: "program",
          reviewerId: staffId,
          action: "unpublished",
        },
      });
      await this.audit(tx, staffId, "unpublish_program", id);
      return updated;
    });
  }

  listVideos() {
    return this.prisma.exerciseVideo.findMany({
      include: { program: true },
      orderBy: [{ programId: "asc" }, { orderIndex: "asc" }],
    });
  }

  async createVideo(staffId: string, body: CreateVideoDto) {
    if (body.programId) await this.assertEditableProgram(body.programId);
    const metadata = await this.youtubeMetadata(body.youtubeUrl);
    return this.prisma.exerciseVideo.create({
      data: {
        programId: body.programId,
        orderIndex: body.orderIndex ?? 0,
        youtubeUrl: this.canonicalYoutubeUrl(metadata.videoId),
        youtubeVideoId: metadata.videoId,
        sourceType: body.sourceType ?? "own_channel",
        title: body.title?.trim() || metadata.title,
        aiDescription: body.aiDescription.trim(),
        thumbnailUrl: metadata.thumbnailUrl,
        language: body.language?.trim() || "th",
        linkStatus: metadata.linkStatus,
        lastLinkCheckedAt: new Date(),
        createdBy: staffId,
      },
    });
  }

  async updateVideo(staffId: string, id: string, body: UpdateVideoDto) {
    const video = await this.prisma.exerciseVideo.findUnique({ where: { id } });
    if (!video) throw new NotFoundException("Exercise video not found");
    if (video.programId) await this.assertEditableProgram(video.programId);
    if (body.programId) await this.assertEditableProgram(body.programId);
    const updated = await this.prisma.exerciseVideo.update({
      where: { id },
      data: {
        programId: body.programId,
        title: body.title?.trim(),
        aiDescription: body.aiDescription?.trim(),
        orderIndex: body.orderIndex,
        language: body.language?.trim(),
      },
    });
    await this.prisma.adminAccessLog.create({
      data: { staffId, action: "update_video", targetId: id },
    });
    return updated;
  }

  async recheckLink(id: string) {
    const video = await this.prisma.exerciseVideo.findUnique({ where: { id } });
    if (!video) throw new NotFoundException("Exercise video not found");
    const metadata = await this.youtubeMetadata(video.youtubeUrl, false);
    return this.prisma.exerciseVideo.update({
      where: { id },
      data: {
        title: metadata.linkStatus === "active" ? metadata.title : video.title,
        thumbnailUrl: metadata.thumbnailUrl ?? video.thumbnailUrl,
        linkStatus: metadata.linkStatus,
        lastLinkCheckedAt: new Date(),
        ...(metadata.linkStatus === "active" ? {} : { status: "archived" }),
      },
    });
  }

  listTags() {
    return this.prisma.contentTag.findMany({
      orderBy: [{ category: "asc" }, { tagName: "asc" }],
    });
  }

  createTag(body: CreateTagDto) {
    return this.prisma.contentTag.upsert({
      where: { tagName: this.normalizeTag(body.tagName) },
      create: {
        tagName: this.normalizeTag(body.tagName),
        category: body.category,
      },
      update: { category: body.category },
    });
  }

  listRules() {
    return this.prisma.programRecommendationRule.findMany({
      include: { program: true },
      orderBy: [{ priority: "desc" }, { conditionTag: "asc" }],
    });
  }

  async createRule(body: CreateRecommendationRuleDto) {
    if (
      body.severityMin !== undefined &&
      body.severityMax !== undefined &&
      body.severityMin > body.severityMax
    ) {
      throw new BadRequestException("severityMin must not exceed severityMax");
    }
    const program = await this.prisma.exerciseProgram.findUnique({
      where: { id: body.targetProgramId },
      select: { id: true },
    });
    if (!program)
      throw new NotFoundException("Target exercise program not found");
    return this.prisma.programRecommendationRule.create({
      data: {
        conditionTag: this.normalizeTag(body.conditionTag),
        severityMin: body.severityMin,
        severityMax: body.severityMax,
        targetProgramId: body.targetProgramId,
        priority: body.priority ?? 0,
      },
    });
  }

  reviewLogs() {
    return this.prisma.contentReviewLog.findMany({
      orderBy: { reviewedAt: "desc" },
      take: 200,
    });
  }

  private async assertEditableProgram(id: string) {
    const program = await this.prisma.exerciseProgram.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!program) throw new NotFoundException("Exercise program not found");
    if (program.status === "published")
      throw new BadRequestException(
        "Unpublish the program before editing videos",
      );
  }

  private async resolveTagIds(tx: Prisma.TransactionClient, names?: string[]) {
    const normalized = [
      ...new Set(
        (names ?? []).map((name) => this.normalizeTag(name)).filter(Boolean),
      ),
    ];
    if (!normalized.length) return [];
    const tags = await tx.contentTag.findMany({
      where: { tagName: { in: normalized } },
      select: { id: true, tagName: true },
    });
    const found = new Set(tags.map((tag) => tag.tagName));
    const missing = normalized.filter((name) => !found.has(name));
    if (missing.length)
      throw new BadRequestException(
        `Unknown content tags: ${missing.join(", ")}`,
      );
    return tags.map((tag) => tag.id);
  }

  private normalizeTag(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  private canonicalYoutubeUrl(videoId: string) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  private youtubeVideoId(rawUrl: string) {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException("Invalid YouTube URL");
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be")
      id = url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (
      [
        "youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtube-nocookie.com",
      ].includes(host)
    ) {
      id =
        url.searchParams.get("v") ??
        url.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/)?.[1] ??
        null;
    }
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id))
      throw new BadRequestException("Unsupported YouTube URL");
    return id;
  }

  private async youtubeMetadata(
    rawUrl: string,
    requireActive = true,
  ): Promise<YoutubeMetadata> {
    const videoId = this.youtubeVideoId(rawUrl);
    const canonicalUrl = this.canonicalYoutubeUrl(videoId);
    let response: Response;
    try {
      response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
        { signal: AbortSignal.timeout(8_000) },
      );
    } catch {
      throw new ServiceUnavailableException(
        "YouTube metadata service is unavailable",
      );
    }

    if (response.status >= 500)
      throw new ServiceUnavailableException(
        "YouTube metadata service is unavailable",
      );
    const linkStatus = response.ok
      ? "active"
      : response.status === 401 || response.status === 403
        ? "private"
        : response.status === 404
          ? "removed"
          : "broken";
    if (requireActive && linkStatus !== "active")
      throw new BadRequestException(`YouTube link is ${linkStatus}`);
    const metadata = response.ok
      ? ((await response.json()) as { title?: string; thumbnail_url?: string })
      : {};
    return {
      videoId,
      title: metadata.title?.trim() || `YouTube video ${videoId}`,
      thumbnailUrl: metadata.thumbnail_url,
      linkStatus,
    };
  }

  private audit(
    tx: Prisma.TransactionClient,
    staffId: string,
    action: string,
    targetId?: string,
    details?: Prisma.InputJsonValue,
  ) {
    return tx.adminAccessLog.create({
      data: { staffId, action, targetId, details },
    });
  }
}
