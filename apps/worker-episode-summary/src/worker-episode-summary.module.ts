import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule, RedisModule, QUEUES } from "@blansole/shared";
import { EpisodeSummaryProcessor } from "./processors/episode-summary.processor";
import { EpisodeSummarySchedulerService } from "./episode-summary-scheduler.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    BullModule.registerQueue({ name: QUEUES.EPISODE_SUMMARY }),
  ],
  providers: [EpisodeSummaryProcessor, EpisodeSummarySchedulerService],
})
export class WorkerEpisodeSummaryModule {}
