import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  BatteryLogDto,
  CalibrateDeviceDto,
  DeviceSyncDto,
  PairDeviceDto,
  UpdateDeviceDto,
} from './dto/device.dto';
import { DeviceService } from './device.service';

interface AuthenticatedUser {
  userId: string;
}

@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.deviceService.list(user.userId);
  }

  @Post('pair')
  pair(@CurrentUser() user: AuthenticatedUser, @Body() body: PairDeviceDto) {
    return this.deviceService.pair(user.userId, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateDeviceDto,
  ) {
    return this.deviceService.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.deviceService.remove(user.userId, id);
  }

  @Post(':id/sync')
  sync(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: DeviceSyncDto,
  ) {
    return this.deviceService.sync(user.userId, id, body);
  }

  @Get(':id/status')
  status(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.deviceService.status(user.userId, id);
  }

  @Post(':id/battery')
  battery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BatteryLogDto,
  ) {
    return this.deviceService.logBattery(user.userId, id, body);
  }

  @Post(':id/calibrate')
  calibrate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CalibrateDeviceDto,
  ) {
    return this.deviceService.calibrate(user.userId, id, body);
  }
}
