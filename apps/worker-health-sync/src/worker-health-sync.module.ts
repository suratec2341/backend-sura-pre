import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule, RedisModule, QUEUES } from '@blansole/shared';
import { HealthSyncProcessor } from './processors/health-sync.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    BullModule.registerQueue({ name: QUEUES.HEALTH_SYNC }),
  ],
  providers: [HealthSyncProcessor],
})
export class WorkerHealthSyncModule {}
