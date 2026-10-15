import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from "class-validator";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { AdminService } from "./admin.service.js";

class AccountStatusDto {
  @IsBoolean()
  suspended!: boolean;

  @ValidateIf((value: AccountStatusDto) => value.suspended)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason?: string;
}

class CampaignStatusDto {
  @IsIn(["ARCHIVED", "PRIVATE"])
  status!: "ARCHIVED" | "PRIVATE";
}

class ReactivationReviewDto {
  @IsIn(["APPROVED", "REJECTED"])
  status!: "APPROVED" | "REJECTED";
  @IsOptional() @IsString() @MaxLength(500) resolutionNote?: string;
}

@Controller("admin")
@UseGuards(AuthGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get("overview")
  overview(@CurrentUser() user: AuthPrincipal, @Query("take") take?: string) {
    this.assertAdmin(user);
    const parsedTake = take === undefined ? 100 : Number(take);
    if (!Number.isInteger(parsedTake) || parsedTake < 1 || parsedTake > 200) throw new BadRequestException("take must be between 1 and 200");
    return this.admin.overview(parsedTake);
  }

  @Get("analytics")
  analytics(@CurrentUser() user: AuthPrincipal, @Query("days") days = "30") {
    this.assertAdmin(user);
    const periodDays = Number(days);
    if (![7, 30, 90, 365].includes(periodDays)) throw new BadRequestException("days must be one of 7, 30, 90, or 365");
    return this.admin.analytics(periodDays);
  }

  @Patch("users/:id/status")
  updateAccountStatus(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: AccountStatusDto) {
    this.assertAdmin(user);
    return this.admin.setSuspended(id, dto.suspended, dto.reason);
  }

  @Get("account-reactivations")
  accountReactivations(@CurrentUser() user: AuthPrincipal, @Query("take") take?: string, @Query("offset") offset?: string) {
    this.assertAdmin(user);
    return this.admin.accountReactivationRequests(Number(take) || 25, Number(offset) || 0);
  }

  @Get("campaigns/:id/applications")
  campaignApplications(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Query("take") take?: string, @Query("offset") offset?: string) {
    this.assertAdmin(user);
    const parsedTake = take === undefined ? 20 : Number(take);
    const parsedOffset = offset === undefined ? 0 : Number(offset);
    if (!Number.isInteger(parsedTake) || parsedTake < 1 || parsedTake > 100) throw new BadRequestException("take must be between 1 and 100");
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) throw new BadRequestException("offset must be zero or greater");
    return this.admin.campaignApplications(id, parsedTake, parsedOffset);
  }

  @Get("proposals")
  proposals(@CurrentUser() user: AuthPrincipal, @Query("take") take?: string, @Query("offset") offset?: string, @Query("q") query?: string, @Query("status") status = "All", @Query("media") media = "All") {
    this.assertAdmin(user);
    const parsedTake = take === undefined ? 20 : Number(take);
    const parsedOffset = offset === undefined ? 0 : Number(offset);
    if (!Number.isInteger(parsedTake) || parsedTake < 1 || parsedTake > 100) throw new BadRequestException("take must be between 1 and 100");
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) throw new BadRequestException("offset must be zero or greater");
    if (query && query.length > 200) throw new BadRequestException("q must be 200 characters or fewer");
    if (!["All", "New", "Accepted", "Declined", "Withdrawn", "Completed"].includes(status)) throw new BadRequestException("Unsupported proposal status");
    if (!["All", "With media", "No media"].includes(media)) throw new BadRequestException("Unsupported media filter");
    return this.admin.proposals(parsedTake, parsedOffset, query, status, media);
  }

  @Get("proposals/:id")
  proposal(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    this.assertAdmin(user);
    return this.admin.proposal(id);
  }

  @Patch("account-reactivations/:id")
  reviewAccountReactivation(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: ReactivationReviewDto) {
    this.assertAdmin(user);
    return this.admin.reviewAccountReactivation(id, user.userId, dto.status, dto.resolutionNote);
  }

  @Patch("campaigns/:id/status")
  updateCampaignStatus(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: CampaignStatusDto) {
    this.assertAdmin(user);
    return this.admin.setCampaignStatus(id, dto.status);
  }

  private assertAdmin(user: AuthPrincipal) {
    if (user.role !== "ADMIN") throw new ForbiddenException("Admin access required");
  }
}
