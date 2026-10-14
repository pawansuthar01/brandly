import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const platforms = ["Instagram", "YouTube", "Threads", "Snapchat", "Facebook", "LinkedIn", "X", "Pinterest", "Twitch", "Reddit", "Discord", "Medium", "Behance", "Other"] as const;
const stages = ["Idea", "Scripting", "Shooting", "Editing", "Thumbnail", "Scheduled", "Published"] as const;

export class CreateStudioIdeaDto {
  @IsString() @MinLength(1) @MaxLength(180)
  title!: string;
  @IsOptional() @IsString() @MaxLength(5_000)
  concept?: string;
  @IsOptional() @IsString() @MaxLength(10_000)
  description?: string;
  @IsOptional() @IsString() @MaxLength(10_000)
  ideaNotes?: string;
  @IsString() @IsIn(platforms)
  platform!: (typeof platforms)[number];
  @IsOptional() @IsBoolean()
  archived?: boolean;
  @IsOptional() @IsString() @MaxLength(120)
  budget?: string;
  @IsOptional() @IsString() @MaxLength(40)
  reminderDate?: string;
  @IsOptional() @IsString() @MaxLength(180)
  shootLocation?: string;
  @IsOptional() @IsString() @MaxLength(500)
  equipment?: string;
  @IsOptional() @IsString() @MaxLength(2_000)
  sourceUrl?: string;
  @IsOptional() @IsObject()
  attachment?: Record<string, unknown>;
}

export class UpdateStudioIdeaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(180)
  title?: string;
  @IsOptional() @IsString() @MaxLength(5_000)
  concept?: string;
  @IsOptional() @IsString() @MaxLength(10_000)
  description?: string;
  @IsOptional() @IsString() @MaxLength(10_000)
  ideaNotes?: string;
  @IsOptional() @IsIn(platforms)
  platform?: (typeof platforms)[number];
  @IsOptional() @IsBoolean()
  archived?: boolean;
  @IsOptional() @IsString() @MaxLength(120)
  budget?: string;
  @IsOptional() @IsString() @MaxLength(40)
  reminderDate?: string;
  @IsOptional() @IsString() @MaxLength(180)
  shootLocation?: string;
  @IsOptional() @IsString() @MaxLength(500)
  equipment?: string;
  @IsOptional() @IsString() @MaxLength(2_000)
  sourceUrl?: string;
  @IsOptional() @IsObject()
  attachment?: Record<string, unknown> | null;
  @IsOptional() @IsArray() @IsObject({ each: true })
  notes?: Record<string, unknown>[];
}

export class StudioNoteDto {
  @IsString() @MinLength(1) @MaxLength(2_000)
  text!: string;
}

export class UpdateStudioProjectDto {
  @IsOptional() @IsString() @MaxLength(40)
  dueDate?: string | null;
  @IsOptional() @IsString() @MaxLength(180)
  assignedTo?: string;
  @IsOptional() @IsBoolean()
  archived?: boolean;
}

export class StudioStageDto {
  @IsIn(stages)
  stage!: (typeof stages)[number];
  @IsObject()
  data!: Record<string, unknown>;
  @IsOptional() @IsBoolean()
  complete?: boolean;
}

export const STUDIO_STAGES = stages;
export type StudioStage = (typeof stages)[number];
