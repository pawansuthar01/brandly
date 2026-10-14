import { IsArray, IsBoolean, IsISO8601, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength, IsUUID } from "class-validator";

const taskKinds = ["task", "video-brief"] as const;

export class TaskListQueryDto {
  @IsOptional() @IsISO8601()
  from?: string;
  @IsOptional() @IsISO8601()
  to?: string;
  @IsOptional() @IsString() @MaxLength(120)
  search?: string;
  @IsOptional() @IsIn(["true", "false"])
  remindersOnly?: "true" | "false";
}

export class CreateTaskDto {
  @IsOptional() @IsUUID("4")
  clientId?: string;
  @IsString() @MinLength(1) @MaxLength(180)
  title!: string;
  @IsOptional() @IsString() @MaxLength(5_000)
  notes?: string;
  @IsString() @MaxLength(20)
  dueDate!: string;
  @IsString() @MaxLength(30)
  dueTime!: string;
  @IsOptional() @IsISO8601()
  reminderAt?: string;
  @IsOptional() @IsBoolean()
  reminderEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(40)
  reminderTone?: string;
  @IsOptional() @IsIn(taskKinds)
  kind?: (typeof taskKinds)[number];
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(2_000, { each: true })
  links?: string[];
  @IsOptional() @IsArray() @IsObject({ each: true })
  attachments?: Record<string, unknown>[];
  @IsOptional() @IsString() @MaxLength(120)
  projectId?: string;
  @IsOptional() @IsString() @MaxLength(80)
  stage?: string;
  @IsOptional() @IsString() @MaxLength(120)
  campaignId?: string;
  @IsOptional() @IsString() @MaxLength(120)
  conversationId?: string;
  @IsOptional() @IsString()
  sourceTaskId?: string;
  @IsOptional() @IsString()
  brandId?: string;
  @IsOptional() @IsString()
  creatorId?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsISO8601()
  expectedReminderAt?: string;
  @IsOptional() @IsIn(taskKinds)
  kind?: (typeof taskKinds)[number];
  @IsOptional() @IsString() @MinLength(1) @MaxLength(180)
  title?: string;
  @IsOptional() @IsString() @MaxLength(5_000)
  notes?: string;
  @IsOptional() @IsString() @MaxLength(20)
  dueDate?: string;
  @IsOptional() @IsString() @MaxLength(30)
  dueTime?: string;
  @IsOptional() @IsISO8601()
  reminderAt?: string | null;
  @IsOptional() @IsBoolean()
  reminderEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(40)
  reminderTone?: string;
  @IsOptional() @IsBoolean()
  completed?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(2_000, { each: true })
  links?: string[];
  @IsOptional() @IsArray() @IsObject({ each: true })
  attachments?: Record<string, unknown>[];
  @IsOptional() @IsString() @MaxLength(120)
  projectId?: string;
  @IsOptional() @IsString() @MaxLength(80)
  stage?: string;
  @IsOptional() @IsString() @MaxLength(120)
  campaignId?: string;
  @IsOptional() @IsString() @MaxLength(120)
  conversationId?: string;
}

export class TaskNoteDto {
  @IsString() @MinLength(1) @MaxLength(2_000)
  text!: string;
}
