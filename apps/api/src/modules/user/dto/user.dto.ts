import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Matches(/^(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/)
  birthday?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gender?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  weight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(300)
  height?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  activityLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  exerciseFrequency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  sedentaryHoursPerDay?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shoeType?: string;

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
  @Transform(({ value }) => typeof value === 'string' ? [value] : value)
  @IsArray()
  @IsString({ each: true })
  conditions?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  injuryHistory?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? [value] : value)
  @IsArray()
  @IsString({ each: true })
  currentMedications?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  painLevel?: number;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? [value] : value)
  @IsArray()
  @IsString({ each: true })
  painPoints?: string[];
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  goal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  goalType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetSteps?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsBoolean()
  darkMode?: boolean;

  @IsOptional()
  @IsIn(['metric', 'imperial'])
  unitSystem?: string;

  @IsOptional()
  @IsIn(['12h', '24h'])
  timeFormat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  dateFormat?: string;
}

export class UpdateConsentDto {
  @IsBoolean()
  granted!: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  version!: string;
}

export class RiskQueryDto {
  @IsOptional()
  @IsIn(['single_session', 'rolling_7d', 'rolling_30d'])
  scope?: string;
}
