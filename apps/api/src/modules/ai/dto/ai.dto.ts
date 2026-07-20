import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const RAG_DOCUMENT_CATEGORIES = [
  'gait_knowledge',
  'pressure_explain',
  'guideline',
  'faq',
  'safety_rule',
] as const;

export class SessionSummaryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sessionId!: string;
}

export class GenerateInsightDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  insightType?: string;
}

export class CreateChatThreadDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  threadId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4_000)
  message!: string;
}

export class IngestRagDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsIn(RAG_DOCUMENT_CATEGORIES)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  version?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  relatedConditionTags?: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(200_000)
  text!: string;
}
