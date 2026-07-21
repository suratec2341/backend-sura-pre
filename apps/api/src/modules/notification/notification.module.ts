import { Module } from "@nestjs/common";
import {
  NotificationController,
  NotificationDeviceController,
  NotificationSettingsController,
} from "./notification.controller";
import { NotificationService } from "./notification.service";

@Module({
  controllers: [
    NotificationController,
    NotificationSettingsController,
    NotificationDeviceController,
  ],
  providers: [NotificationService],
})
export class NotificationModule {}
