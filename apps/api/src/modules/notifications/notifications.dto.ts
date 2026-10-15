import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";

export class NotificationPreferencesDto {
  @IsBoolean() messages!: boolean;
  @IsBoolean() profileActivity!: boolean;
  @IsBoolean() proposalUpdates!: boolean;
  @IsBoolean() taskUpdates!: boolean;
}

export class RegisterDeviceDto {
  @IsString()
  @MinLength(10)
  @MaxLength(512)
  token!: string;

  @IsIn(["ios", "android", "web"])
  platform!: "ios" | "android" | "web";

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @IsOptional()
  @IsBoolean()
  supportsLocalReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  sessionActive?: boolean;
}

export class CreateNotificationDto {
  @IsString()
  @MaxLength(80)
  userId!: string;

  @IsString()
  @MaxLength(80)
  type!: string;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(2_000)
  body!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsIn(["IN_APP", "PUSH", "WHATSAPP", "EMAIL"], { each: true })
  channels?: Array<"IN_APP" | "PUSH" | "WHATSAPP" | "EMAIL">;
}

export class AdminNotificationDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  userIds!: string[];

  @IsString()
  @MaxLength(80)
  type!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  body!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsIn(["IN_APP", "PUSH", "WHATSAPP", "EMAIL"], { each: true })
  channels?: Array<"IN_APP" | "PUSH" | "WHATSAPP" | "EMAIL">;
}

export class AdminNotificationLogsQueryDto {
  @IsOptional() @IsString() @Matches(/^\d{1,3}$/)
  take?: string;

  @IsOptional() @IsString() @Matches(/^\d{1,9}$/)
  offset?: string;

  @IsOptional() @IsString() @MaxLength(120)
  search?: string;

  @IsOptional() @IsString() @MaxLength(80)
  type?: string;

  @IsOptional() @IsIn(["App", "Admin"])
  source?: "App" | "Admin";

  @IsOptional() @IsIn(["IN_APP", "PUSH", "EMAIL", "WHATSAPP"])
  channel?: "IN_APP" | "PUSH" | "EMAIL" | "WHATSAPP";
}
