import { Module } from '@nestjs/common';
import {
  NotificationController,
  NotificationSettingsController,
} from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController, NotificationSettingsController],
  providers: [NotificationService],
})
export class NotificationModule {}
