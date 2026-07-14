import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService, RedisModule, QUEUES } from '@blansole/shared';
import { SessionProcessor } from './processors/session.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    BullModule.registerQueue({ name: QUEUES.SESSION_PROCESS }),
  ],
  providers: [PrismaService, SessionProcessor],
})
export class WorkerSessionModule {}
