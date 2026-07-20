import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PairDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceSerial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serial?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  deviceModel!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  hardwareVersion!: string;

  @IsOptional()
  @IsBoolean()
  autoReconnect?: boolean;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsBoolean()
  autoReconnect?: boolean;
}

export class DeviceSyncDto {
  @IsOptional()
  @IsIn(['manual', 'automatic', 'background'])
  syncType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  steps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distance?: number;

  @IsOptional()
  @IsBoolean()
  pressureDataSynced?: boolean;
}

export class BatteryLogDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLeft?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  batteryRight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-127)
  @Max(20)
  signalStrength?: number;

  @IsOptional()
  @IsString()
  sensorStatus?: string;

  @IsOptional()
  @IsString()
  bluetoothStatus?: string;
}

export class CalibrateDeviceDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(60)
  footSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(60)
  footSizeLeft?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(60)
  footSizeRight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  weight?: number;

  @IsOptional()
  @IsObject()
  baselinePressureMap?: Record<string, unknown>;
}
