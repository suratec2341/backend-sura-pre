import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule, RedisModule, QUEUES } from '@blansole/shared';
import { SessionProcessor } from './processors/session.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    BullModule.registerQueue({ name: QUEUES.SESSION_PROCESS }),
  ],
  providers: [SessionProcessor],
})
export class WorkerSessionModule {}
