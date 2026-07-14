import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { sanitizeAiPrompt } from '../../utils/sanitizer.util';

@Controller('ai')
export class AiController {
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('session-summary')
  sessionSummary(@Body() body: any) { return { message: 'AI session summary — TODO (→ enqueue to Python worker)' }; }

  @Post('insight')
  insight(@Body() body: any) { return { message: 'AI insight — TODO' }; }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('chat')
  chat(@Body() body: any) {
    const sanitizedInput = body?.message ? sanitizeAiPrompt(body.message) : undefined;
    return { 
      message: 'AI chat — TODO (→ enqueue to Python worker)',
      received: sanitizedInput || 'no input'
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
