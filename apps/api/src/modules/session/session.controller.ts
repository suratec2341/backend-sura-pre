import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

@Controller('sessions')
export class SessionController {
  @Post('start')
  start(@Body() body: any) { return { message: 'Start session — TODO' }; }

  @Post(':id/data')
  pushData(@Param('id') id: string, @Body() body: any) { return { message: `Push data to ${id} — TODO` }; }

  @Post(':id/finish')
  finish(@Param('id') id: string) { return { message: `Finish session ${id} — TODO (→ enqueue worker)` }; }

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // Limit heavy batch sync operations
  @Post('sync-batch')
  syncBatch(@Body() body: any) { return { message: 'Offline sync batch — TODO' }; }

  @Get()
  list() { return { message: 'List sessions — TODO' }; }

  @Get(':id')
  get(@Param('id') id: string) { return { message: `Get session ${id} — TODO` }; }

  @Get(':id/pressure-map')
  pressureMap(@Param('id') id: string) { return { message: `Pressure map ${id} — TODO` }; }

  @Get(':id/gait-analysis')
  gaitAnalysis(@Param('id') id: string) { return { message: `Gait analysis ${id} — TODO` }; }

  @Get(':id/insight')
  insight(@Param('id') id: string) { return { message: `AI insight ${id} — TODO` }; }
}
