import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { NestFactory } from "@nestjs/core";
import { PrismaService, QUEUES, RedisModule } from "@blansole/shared";
import { EpisodeSummaryProcessor } from "./processors/episode-summary.processor";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    BullModule.registerQueue({ name: QUEUES.EPISODE_SUMMARY }),
  ],
  providers: [PrismaService, EpisodeSummaryProcessor],
})
class WorkerEpisodeSummaryModule {}

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerEpisodeSummaryModule);
  console.log("Episode Summary Worker started - listening for jobs");
}

bootstrap().catch((error) => {
  console.error("Failed to start Episode Summary Worker", error);
  process.exit(1);
});
