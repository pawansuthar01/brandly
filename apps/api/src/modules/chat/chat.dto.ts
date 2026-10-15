import { ArrayMaxSize, IsArray, IsBoolean, IsObject, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateChatMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  text?: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  attachments?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMessageId?: string;

  @IsOptional()
  @IsUUID("4")
  replyToId?: string;

  @IsOptional()
  @IsUUID("4")
  taskId?: string;

  @IsOptional()
  @IsUUID("4")
  campaignApplicationId?: string;
}

export class UpdateChatMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  text?: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  attachments?: Record<string, unknown>[];
}

export class ChatPresenceDto {
  @IsOptional()
  @IsUUID("4")
  applicationId?: string;
}

export class ChatTypingDto {
  @IsUUID("4")
  applicationId!: string;

  @IsBoolean()
  typing!: boolean;
}

export class AdminChatMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMessageId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsObject({ each: true })
  attachments?: Record<string, unknown>[];

  @IsOptional()
  @IsUUID("4")
  replyToId?: string;
}

export class AdminChatHeartbeatDto {
  @IsOptional()
  @IsUUID("4")
  conversationId?: string;
}
