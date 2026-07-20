import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { SessionProcessingQueueService } from './session-processing-queue.service';

@Module({
  controllers: [SessionController],
  providers: [SessionService, SessionProcessingQueueService],
  exports: [SessionService],
})
export class SessionModule {}
