import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
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
  ValidateNested,
} from 'class-validator';

export class StartSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  activityType?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  clientSessionUuid?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class SensorSampleDto {
  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sequence?: number;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class PushSessionDataDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SensorSampleDto)
  samples?: SensorSampleDto[];

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sequence?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;
}

export class SyncBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  session_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  device_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  deviceType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SensorSampleDto)
  samples?: SensorSampleDto[];
}

export class PressureZoneDto {
  @IsIn(['left', 'right'])
  footSide!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  forefootPercent!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  midfootPercent!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  heelPercent!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPressure!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  avgPressure!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  hotspotArea?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  pressureLevel?: string;
}

export class FinishSessionDto {
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSec?: number;

  /** Frontend compatibility: duration in minutes. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  duration?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  steps?: number;

  @IsOptional()
  @Transform(({ value }) => value === undefined ? value : Number(value))
  @IsNumber()
  @Min(0)
  distance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  calories?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  peakLeft?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  peakRight?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PressureZoneDto)
  pressureZones?: PressureZoneDto[];
}

export class SessionListQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cursor?: string;
}
