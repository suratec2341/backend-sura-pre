import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrismaService, Role } from '@blansole/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { sanitizeAiPrompt } from '../../utils/sanitizer.util';
import { AiService } from './ai.service';
import {
  ChatMessageDto,
  CreateChatThreadDto,
  GenerateInsightDto,
  IngestRagDocumentDto,
  SessionSummaryDto,
} from './dto/ai.dto';
import { chunkRagText } from './rag-chunker.util';

interface AuthenticatedUser {
  userId: string;
  email?: string;
  role?: Role;
}

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('session-summary')
  @HttpCode(HttpStatus.ACCEPTED)
  async sessionSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SessionSummaryDto,
  ) {
    const session = await this.prisma.activitySession.findFirst({
      where: { id: body.sessionId, userId: user.userId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Activity session not found');

    const taskId = await this.aiService.dispatchSessionSummaryTask(body.sessionId);
    return { message: 'AI session summary task queued', taskId };
  }

  @Get('insight')
  async latestInsight(@CurrentUser() user: AuthenticatedUser) {
    const insight = await this.prisma.aiInsight.findFirst({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
    });
    return { insight };
  }

  @Post('insight')
  async insight(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenerateInsightDto,
  ) {
    const session = await this.prisma.activitySession.findFirst({
      where: { userId: user.userId, ...(body.sessionId ? { id: body.sessionId } : {}) },
      orderBy: { startedAt: 'desc' },
      include: { metrics: true, pressureZones: true },
    });
    if (body.sessionId && !session) throw new NotFoundException('Activity session not found');

    const risk = await this.prisma.riskAssessment.findFirst({
      where: { userId: user.userId },
      orderBy: { computedAt: 'desc' },
    });
    const text = this.composeInsight(session, risk);
    const created = await this.prisma.aiInsight.create({
      data: {
        userId: user.userId,
        sessionId: session?.id,
        insightText: text,
        insightType: body.insightType?.trim() || 'daily_summary',
        modelVersion: 'rules-v1',
        promptVersion: 'dashboard-v1',
      },
    });
    return { insight: created };
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('chat')
  @HttpCode(HttpStatus.ACCEPTED)
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChatMessageDto,
  ) {
    const thread = await this.prisma.aiChatThread.findFirst({
      where: { id: body.threadId, userId: user.userId },
      select: { id: true, archivedAt: true },
    });
    if (!thread) throw new NotFoundException('Chat thread not found');
    if (thread.archivedAt) throw new BadRequestException('Chat thread is archived');

    const sanitizedInput = sanitizeAiPrompt(body.message).trim();
    if (!sanitizedInput) {
      throw new BadRequestException('Message is empty after sanitization');
    }

    const taskId = await this.aiService.dispatchChatMessageTask(body.threadId, sanitizedInput);
    return {
      message: 'AI chat task queued',
      taskId,
      threadId: body.threadId,
    };
  }

  @Post('chat/threads')
  async createThread(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateChatThreadDto,
  ) {
    const title = body.title?.trim();
    return this.prisma.aiChatThread.create({
      data: {
        userId: user.userId,
        title: title || undefined,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        archivedAt: true,
      },
    });
  }

  @Get('chat/threads')
  listThreads(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.aiChatThread.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        createdAt: true,
        archivedAt: true,
        _count: { select: { messages: true } },
      },
    });
  }

  @Get('chat/threads/:threadId/tasks/:taskId')
  async getChatTaskState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.assertThreadOwnership(threadId, user.userId);
    const state = await this.aiService.getTaskState(taskId);

    if (state.status === 'SUCCESS') {
      const result = state.result as { threadId?: string } | null;
      if (!result || result.threadId !== threadId) {
        throw new NotFoundException('Task not found for this chat thread');
      }
    }

    return state;
  }

  @Get('chat/threads/:id')
  async getThread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const thread = await this.prisma.aiChatThread.findFirst({
      where: { id, userId: user.userId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        archivedAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            role: true,
            content: true,
            contextSnapshotRef: true,
            modelVersion: true,
            createdAt: true,
          },
        },
      },
    });
    if (!thread) throw new NotFoundException('Chat thread not found');

    return { ...thread, messages: thread.messages.reverse() };
  }

  // ⭐ §5.6 — Deterministic program recommendation
  @Post('recommend-program')
  recommendProgram(@Body() body: any) {
    return { message: 'Recommend program — TODO (deterministic match + AI compose)' };
  }

  @Post('rag/document')
  @Roles(Role.ADMIN, Role.CONTENT_EDITOR)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestRagDocument(@Body() body: IngestRagDocumentDto) {
    const chunks = chunkRagText(body.text);
    if (!chunks.length) throw new BadRequestException('Document text is empty');

    const doc = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ragDocument.create({
        data: {
          title: body.title.trim(),
          category: body.category,
          version: body.version?.trim() || '1.0',
          relatedConditionTags: body.relatedConditionTags ?? [],
          // Retrieval only sees active documents. The worker activates this
          // record after every chunk has a persisted embedding.
          isActive: false,
        },
      });

      await tx.ragChunk.createMany({
        data: chunks.map((chunkText, chunkIndex) => ({
          documentId: created.id,
          chunkText,
          chunkIndex,
        })),
      });

      return created;
    });

    const taskId = await this.aiService.dispatchEmbedDocumentTask(doc.id);
    return {
      message: 'Document created and embedding task queued',
      documentId: doc.id,
      chunkCount: chunks.length,
      taskId,
    };
  }

  private async assertThreadOwnership(threadId: string, userId: string) {
    const thread = await this.prisma.aiChatThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true },
    });
    if (!thread) throw new NotFoundException('Chat thread not found');
  }

  private composeInsight(
    session: {
      metrics: { steps: number | null; balanceScore: number | null } | null;
      pressureZones: Array<{ footSide: string; hotspotArea: string | null; pressureLevel: string }>;
    } | null,
    risk: { assessmentType: string; riskLevel: string; score: number } | null,
  ) {
    if (!session) return 'Complete a walking session to receive a personalized movement insight.';
    const parts: string[] = [];
    if (session.metrics?.steps !== null && session.metrics?.steps !== undefined) {
      parts.push(`You recorded ${session.metrics.steps.toLocaleString('en-US')} steps.`);
    }
    const hotspot = session.pressureZones.find((zone) => zone.hotspotArea);
    if (hotspot) {
      parts.push(`The main pressure area was ${hotspot.hotspotArea} on the ${hotspot.footSide} foot (${hotspot.pressureLevel} level).`);
    }
    if (risk) {
      parts.push(`Latest ${risk.assessmentType.replaceAll('_', ' ')} is ${risk.riskLevel} (${Math.round(risk.score)}%).`);
    }
    return parts.join(' ') || 'Your latest session was saved and is ready for deeper analysis.';
  }
}
