import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  MarkNotificationsReadDto,
  NotificationListQueryDto,
  UpdateNotificationSettingsDto,
} from './dto/notification.dto';
import { NotificationService } from './notification.service';

interface AuthenticatedUser {
  userId: string;
}

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationListQueryDto,
  ) {
    return this.notificationService.list(user.userId, query);
  }

  @Post('read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MarkNotificationsReadDto,
  ) {
    return this.notificationService.markRead(user.userId, body.notificationIds);
  }
}

@Controller('notification-settings')
export class NotificationSettingsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.getSettings(user.userId);
  }

  @Put()
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateNotificationSettingsDto,
  ) {
    return this.notificationService.updateSettings(user.userId, body);
  }
}
