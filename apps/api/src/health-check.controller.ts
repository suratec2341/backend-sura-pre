import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthCheckController {
  @Get('healthz')
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
