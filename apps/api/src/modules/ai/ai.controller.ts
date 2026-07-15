import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { sanitizeAiPrompt } from '../../utils/sanitizer.util';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('session-summary')
  async sessionSummary(@Body() body: any) {
    if (!body?.sessionId) return { message: 'Missing sessionId' };
    const taskId = await this.aiService.dispatchSessionSummaryTask(body.sessionId);
    return { message: 'AI session summary task queued', taskId };
  }

  @Post('insight')
  insight(@Body() body: any) { return { message: 'AI insight — TODO' }; }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('chat')
  async chat(@Body() body: any) {
    const sanitizedInput = body?.message ? sanitizeAiPrompt(body.message) : undefined;
    if (!body?.threadId || !sanitizedInput) return { message: 'Missing threadId or message' };

    const taskId = await this.aiService.dispatchChatMessageTask(body.threadId, sanitizedInput);
    return { 
      message: 'AI chat task queued',
      taskId,
      received: sanitizedInput
    }; 
  }

  @Get('chat/threads')
  listThreads() { return { message: 'List chat threads — TODO' }; }

  @Get('chat/threads/:id')
  getThread(@Param('id') id: string) { return { message: `Get thread ${id} — TODO` }; }

  // ⭐ §5.6 — Deterministic program recommendation
  @Post('recommend-program')
  recommendProgram(@Body() body: any) {
    return { message: 'Recommend program — TODO (deterministic match + AI compose)' };
  }
}
