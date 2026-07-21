import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import {
  MarkNotificationsReadDto,
  NotificationListQueryDto,
  RegisterPushDeviceDto,
  UpdateNotificationSettingsDto,
} from "./dto/notification.dto";
import { NotificationService } from "./notification.service";

interface AuthenticatedUser {
  userId: string;
}

@Controller("notifications")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationListQueryDto,
  ) {
    return this.notificationService.list(user.userId, query);
  }

  @Post("read")
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MarkNotificationsReadDto,
  ) {
    return this.notificationService.markRead(user.userId, body.notificationIds);
  }
}

@Controller("notification-settings")
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

@Controller("notification-devices")
export class NotificationDeviceController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.listPushDevices(user.userId);
  }

  @Post()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegisterPushDeviceDto,
  ) {
    return this.notificationService.registerPushDevice(user.userId, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    await this.notificationService.removePushDevice(user.userId, id);
  }
}
