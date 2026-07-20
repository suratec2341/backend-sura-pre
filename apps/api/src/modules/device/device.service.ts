import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@blansole/shared';
import {
  BatteryLogDto,
  CalibrateDeviceDto,
  DeviceSyncDto,
  PairDeviceDto,
  UpdateDeviceDto,
} from './dto/device.dto';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.userDevice.findMany({
      where: { userId, unpairedAt: null },
      include: {
        device: true,
        statusLogs: { orderBy: { loggedAt: 'desc' }, take: 1 },
        batteryLogs: { orderBy: { loggedAt: 'desc' }, take: 1 },
        calibrations: { orderBy: { calibratedAt: 'desc' }, take: 1 },
      },
      orderBy: { pairedAt: 'desc' },
    });
  }

  async pair(userId: string, body: PairDeviceDto) {
    const serial = (body.deviceSerial ?? body.serial)?.trim();
    if (!serial) throw new BadRequestException('deviceSerial or serial is required');

    const activePair = await this.prisma.userDevice.findFirst({
      where: { deviceSerial: serial, unpairedAt: null },
      include: { device: true },
    });
    if (activePair?.userId === userId) return activePair;
    if (activePair) throw new ConflictException('Device is already paired to another account');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const device = await tx.device.upsert({
          where: { deviceModel: body.deviceModel.trim() },
          create: {
            deviceModel: body.deviceModel.trim(),
            hardwareVersion: body.hardwareVersion.trim(),
          },
          update: { hardwareVersion: body.hardwareVersion.trim() },
        });
        return tx.userDevice.create({
          data: {
            userId,
            deviceId: device.id,
            deviceSerial: serial,
            autoReconnect: body.autoReconnect ?? true,
            statusLogs: {
              create: { sensorStatus: 'ready', bluetoothStatus: 'connected' },
            },
          },
          include: { device: true, statusLogs: true },
        });
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('Device is already paired to another account');
      }
      throw error;
    }
  }

  async update(userId: string, id: string, body: UpdateDeviceDto) {
    await this.assertOwnedDevice(userId, id);
    return this.prisma.userDevice.update({ where: { id }, data: body });
  }

  async remove(userId: string, id: string) {
    await this.assertOwnedDevice(userId, id);
    await this.prisma.$transaction([
      this.prisma.userDevice.update({ where: { id }, data: { unpairedAt: new Date() } }),
      this.prisma.deviceStatusLog.create({
        data: { userDeviceId: id, sensorStatus: 'inactive', bluetoothStatus: 'disconnected' },
      }),
    ]);
  }

  async sync(userId: string, id: string, body: DeviceSyncDto) {
    await this.assertOwnedDevice(userId, id);
    return this.prisma.deviceSyncLog.create({
      data: {
        userDeviceId: id,
        syncType: body.syncType ?? 'manual',
        stepsSynced: body.steps,
        distanceSynced: body.distance,
        pressureDataSynced: body.pressureDataSynced,
        status: 'completed',
      },
    });
  }

  async status(userId: string, id: string) {
    const device = await this.prisma.userDevice.findFirst({
      where: { id, userId, unpairedAt: null },
      include: {
        device: true,
        statusLogs: { orderBy: { loggedAt: 'desc' }, take: 1 },
        batteryLogs: { orderBy: { loggedAt: 'desc' }, take: 1 },
      },
    });
    if (!device) throw new NotFoundException('Device not found');
    const latestStatus = device.statusLogs[0] ?? null;
    const battery = device.batteryLogs[0] ?? null;
    return {
      id: device.id,
      serial: device.deviceSerial,
      model: device.device.deviceModel,
      connected: latestStatus?.bluetoothStatus === 'connected',
      sensorStatus: latestStatus?.sensorStatus ?? 'unknown',
      bluetoothStatus: latestStatus?.bluetoothStatus ?? 'unknown',
      signalStrength: latestStatus?.signalStrength ?? null,
      batteryLeft: battery?.batteryLeft ?? null,
      batteryRight: battery?.batteryRight ?? null,
      lastSeenAt: latestStatus?.loggedAt ?? battery?.loggedAt ?? null,
    };
  }

  async logBattery(userId: string, id: string, body: BatteryLogDto) {
    await this.assertOwnedDevice(userId, id);
    if (body.batteryLeft === undefined && body.batteryRight === undefined) {
      throw new BadRequestException('batteryLeft or batteryRight is required');
    }
    return this.prisma.$transaction(async (tx) => {
      const battery = await tx.deviceBatteryLog.create({
        data: {
          userDeviceId: id,
          batteryLeft: body.batteryLeft,
          batteryRight: body.batteryRight,
        },
      });
      if (body.signalStrength !== undefined || body.sensorStatus || body.bluetoothStatus) {
        await tx.deviceStatusLog.create({
          data: {
            userDeviceId: id,
            signalStrength: body.signalStrength,
            sensorStatus: body.sensorStatus,
            bluetoothStatus: body.bluetoothStatus,
          },
        });
      }
      return battery;
    });
  }

  async calibrate(userId: string, id: string, body: CalibrateDeviceDto) {
    await this.assertOwnedDevice(userId, id);
    if (body.footSize === undefined
      && body.footSizeLeft === undefined
      && body.footSizeRight === undefined
      && body.weight === undefined
      && body.baselinePressureMap === undefined) {
      throw new BadRequestException('At least one calibration value is required');
    }
    return this.prisma.$transaction(async (tx) => {
      const calibration = await tx.deviceCalibration.create({
        data: {
          userDeviceId: id,
          footSize: body.footSize,
          footSizeLeft: body.footSizeLeft,
          footSizeRight: body.footSizeRight,
          weightAtCalibrationKg: body.weight,
          baselinePressureMap: body.baselinePressureMap
            ? JSON.stringify(body.baselinePressureMap)
            : undefined,
        },
      });
      if (body.footSizeLeft !== undefined || body.footSizeRight !== undefined || body.weight !== undefined) {
        await tx.userProfile.upsert({
          where: { userId },
          create: {
            userId,
            footSizeLeft: body.footSizeLeft,
            footSizeRight: body.footSizeRight,
            weightKg: body.weight,
          },
          update: {
            footSizeLeft: body.footSizeLeft,
            footSizeRight: body.footSizeRight,
            weightKg: body.weight,
          },
        });
      }
      return calibration;
    });
  }

  private async assertOwnedDevice(userId: string, id: string) {
    const device = await this.prisma.userDevice.findFirst({
      where: { id, userId, unpairedAt: null },
      select: { id: true },
    });
    if (!device) throw new NotFoundException('Device not found');
  }
}
