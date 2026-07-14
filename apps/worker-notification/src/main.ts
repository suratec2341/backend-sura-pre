import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { PrismaService, RedisModule, QUEUES } from "@blansole/shared";
import { NotificationProcessor } from "./processors/notification.processor";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    BullModule.registerQueue({ name: QUEUES.NOTIFICATION }),
  ],
  providers: [PrismaService, NotificationProcessor],
})
class WorkerNotificationModule {}

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerNotificationModule);
  console.log("🔔 Notification Worker started — listening for jobs");
}

bootstrap().catch((error) => {
  console.error("Failed to start Notification Worker", error);
  process.exit(1);
});
