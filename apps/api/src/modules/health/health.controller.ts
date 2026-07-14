import { Controller, Get, Post, Delete, Param } from '@nestjs/common';

@Controller('health-integrations')
export class HealthController {
  @Get()
  list() { return { message: 'List health integrations — TODO' }; }

  @Post('connect')
  connect() { return { message: 'Connect health integration — TODO' }; }

  @Post('sync')
  sync() { return { message: 'Sync health data — TODO' }; }

  @Delete(':id')
  disconnect(@Param('id') id: string) { return { message: `Disconnect ${id} — TODO` }; }
}
