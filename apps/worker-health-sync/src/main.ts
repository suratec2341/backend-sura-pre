import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { NestFactory } from "@nestjs/core";
import { PrismaService, QUEUES, RedisModule } from "@blansole/shared";
import { HealthSyncProcessor } from "./processors/health-sync.processor";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    BullModule.registerQueue({ name: QUEUES.HEALTH_SYNC }),
  ],
  providers: [PrismaService, HealthSyncProcessor],
})
class WorkerHealthSyncModule {}

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerHealthSyncModule);
  console.log("Health Sync Worker started - listening for jobs");
}

bootstrap().catch((error) => {
  console.error("Failed to start Health Sync Worker", error);
  process.exit(1);
});
