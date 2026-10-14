import { IsArray, IsBoolean, IsISO8601, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, IsUUID } from "class-validator";

const campaignStatuses = ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"] as const;
const campaignVisibilities = ["PUBLIC", "PRIVATE"] as const;
const applicationStatuses = ["PENDING", "ACCEPTED", "DECLINED", "WITHDRAWN"] as const;

export class CampaignListQueryDto {
  @IsOptional() @IsString() @MaxLength(120)
  search?: string;
  @IsOptional() @IsIn(["true", "false"])
  includeClosed?: "true" | "false";
  @IsOptional() @IsUUID("4")
  creatorId?: string;
}

export class CreateCampaignDto {
  @IsString() @MinLength(2) @MaxLength(180)
  title!: string;
  @IsString() @MinLength(1) @MaxLength(5_000)
  description!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(120, { each: true })
  targetLocations?: string[];
  @IsOptional() @IsString() @MaxLength(120)
  city?: string;
  @IsString() @MinLength(1) @MaxLength(120)
  category!: string;
  @IsString() @MinLength(1) @MaxLength(120)
  budget!: string;
  @IsOptional() @IsISO8601()
  deadlineAt?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(60, { each: true })
  platforms?: string[];
  @IsOptional() @IsString() @MaxLength(5_000)
  deliverables?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(300, { each: true })
  requirements?: string[];
  @IsOptional() @IsString() @MaxLength(5_000)
  creatorRequirements?: string;
  @IsOptional() @IsArray() @IsObject({ each: true })
  media?: Record<string, unknown>[];
  @IsOptional() @IsString() @MaxLength(2_000)
  collaborationVideoUrl?: string;
  @IsOptional() @IsString() @MaxLength(120)
  collaborationVideoLabel?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100_000)
  applicationLimit?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(100_000)
  approvalLimit?: number | null;
  @IsOptional() @IsBoolean()
  closeOnApplicationLimit?: boolean;
  @IsOptional() @IsBoolean()
  closeOnApprovalLimit?: boolean;
  @IsOptional() @IsIn(campaignVisibilities)
  visibility?: (typeof campaignVisibilities)[number];
  @IsOptional() @IsBoolean()
  publish?: boolean;
}

export class UpdateCampaignDto extends CreateCampaignDto {
  @IsOptional() @IsIn(campaignStatuses)
  status?: (typeof campaignStatuses)[number];
}

export class CreateCampaignApplicationDto {
  @IsOptional() @IsString() @MaxLength(5_000)
  message?: string;
  @IsOptional() @IsObject()
  responses?: Record<string, unknown>;
  @IsOptional() @IsArray() @IsObject({ each: true })
  attachments?: Record<string, unknown>[];
  @IsOptional() @IsBoolean()
  contactShared?: boolean;
}

export class InviteCampaignCreatorDto {
  @IsUUID("4")
  creatorId!: string;
  @IsOptional() @IsString() @MaxLength(5_000)
  message?: string;
}

export class UpdateCampaignApplicationDto {
  @IsIn(applicationStatuses)
  status!: (typeof applicationStatuses)[number];
  @IsOptional() @IsString() @MaxLength(1_000)
  rejectionReason?: string;
  @IsOptional() @IsBoolean()
  allowReapply?: boolean;
}

export class CreateCampaignReviewDto {
  @IsInt() @Min(1) @Max(5)
  rating!: number;
  @IsString() @MinLength(10) @MaxLength(2_000)
  text!: string;
}

export class UpdateCampaignPaymentDto {
  @IsString() @Matches(/^\d{1,10}(?:\.\d{1,2})?$/)
  amount!: string;
  @IsBoolean()
  paid!: boolean;
}
