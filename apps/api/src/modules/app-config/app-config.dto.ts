import { IsArray, IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from "class-validator";

export class WhatsAppSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(300)
  apiKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  session!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  senderName?: string;
}

export class SmtpSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @MaxLength(180)
  host!: string;

  @IsString()
  @Matches(/^\d{2,5}$/)
  port!: string;

  @IsIn(["TLS", "SSL", "None"])
  encryption!: "TLS" | "SSL" | "None";

  @IsString()
  @MaxLength(180)
  username!: string;

  @IsString()
  @MaxLength(300)
  password!: string;

  @IsString()
  @MaxLength(120)
  fromName!: string;

  @IsEmail()
  fromEmail!: string;

  @IsOptional()
  @IsEmail()
  replyTo?: string;
}

export class AdminAppSettingsDto {
  @IsObject()
  settings!: Record<string, unknown>;

  @IsArray()
  versions!: unknown[];
}
