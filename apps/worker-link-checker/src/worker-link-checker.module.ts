import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule, RedisModule, QUEUES } from "@blansole/shared";
import { LinkCheckerProcessor } from "./processors/link-checker.processor";
import { LinkCheckSchedulerService } from "./link-check-scheduler.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    BullModule.registerQueue({ name: QUEUES.LINK_CHECK }),
  ],
  providers: [LinkCheckerProcessor, LinkCheckSchedulerService],
})
export class WorkerLinkCheckerModule {}
