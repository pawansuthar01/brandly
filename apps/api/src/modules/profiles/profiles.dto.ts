import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from "class-validator";
import { ProfileVisibility, UserRole } from "@prisma/client";

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  focus?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  avatarUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  audienceSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  rateRange?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  teamSize?: string;

  @IsOptional()
  @IsEnum(ProfileVisibility)
  visibility?: ProfileVisibility;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @IsOptional()
  @IsIn(["profile", "details", "social", "verifying", "review", "success"])
  onboardingStep?: "profile" | "details" | "social" | "verifying" | "review" | "success";
}

export class SocialAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  platform!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  handle!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  profileUrl?: string;
}

export class ContentVerificationDto {
  @IsString()
  @IsIn(["profile", "post", "video", "story"])
  contentType!: "profile" | "post" | "video" | "story";

  @IsUrl({ require_tld: false })
  contentUrl!: string;
}

export class ReviewContentVerificationDto {
  @IsIn(["VERIFIED", "REJECTED"])
  status!: "VERIFIED" | "REJECTED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewerNote?: string;
}

export class ReviewSocialAccountDto {
  @IsIn(["VERIFIED"])
  status!: "VERIFIED";

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  followerCount?: number;
}

export class ProfileDirectoryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsIn(["true", "false"])
  saved?: "true" | "false";
}

export class ProfileInteractionDto {
  @IsBoolean()
  active!: boolean;
}
