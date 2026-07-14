import { Controller, Get, Post, Put, Body } from '@nestjs/common';

@Controller('notifications')
export class NotificationController {
  @Get()
  list() { return { message: 'List notifications — TODO' }; }

  @Post('read')
  markRead(@Body() body: any) { return { message: 'Mark read — TODO' }; }
}

@Controller('notification-settings')
export class NotificationSettingsController {
  @Get()
  getSettings() { return { message: 'Get notification settings — TODO' }; }

  @Put()
  updateSettings(@Body() body: any) { return { message: 'Update notification settings — TODO' }; }
}
