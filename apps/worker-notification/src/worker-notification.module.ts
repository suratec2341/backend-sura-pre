import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule, RedisModule, QUEUES } from "@blansole/shared";
import { NotificationProcessor } from "./processors/notification.processor";
import { NotificationSchedulerService } from "./notification-scheduler.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    BullModule.registerQueue({ name: QUEUES.NOTIFICATION }),
  ],
  providers: [NotificationProcessor, NotificationSchedulerService],
})
export class WorkerNotificationModule {}
