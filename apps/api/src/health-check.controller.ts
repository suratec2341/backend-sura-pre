import { Controller, Get } from '@nestjs/common';
import { Public } from './modules/auth/decorators/public.decorator';

@Controller()
export class HealthCheckController {
  @Public()
  @Get('healthz')
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
