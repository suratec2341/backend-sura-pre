import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class ProgramListQueryDto {
  @IsOptional()
  @IsIn(["draft", "in_review", "published", "archived"])
  status?: string;
}

export class CreateProgramDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(104)
  durationWeeks?: number;

  @IsOptional()
  @IsIn(["beginner", "intermediate", "advanced"])
  difficulty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  version?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  tagNames?: string[];
}

export class UpdateProgramDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(104)
  durationWeeks?: number;

  @IsOptional()
  @IsIn(["beginner", "intermediate", "advanced"])
  difficulty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  version?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  tagNames?: string[];
}

export class CreateVideoDto {
  @IsOptional()
  @IsString()
  programId?: string;

  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_000)
  youtubeUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8_000)
  aiDescription!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000)
  orderIndex?: number;

  @IsOptional()
  @IsIn(["own_channel", "external_licensed"])
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;
}

export class UpdateVideoDto {
  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(8_000)
  aiDescription?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000)
  orderIndex?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;
}

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  tagName!: string;

  @IsIn(["condition", "body_part", "risk_level", "goal"])
  category!: string;
}

export class CreateRecommendationRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  conditionTag!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  severityMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  severityMax?: number;

  @IsString()
  @IsNotEmpty()
  targetProgramId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1_000)
  @Max(1_000)
  priority?: number;
}
