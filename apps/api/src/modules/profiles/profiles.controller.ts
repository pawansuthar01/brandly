import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { ContentVerificationDto, ProfileDirectoryQueryDto, ProfileInteractionDto, ReviewContentVerificationDto, ReviewSocialAccountDto, SocialAccountDto, UpdateProfileDto } from "./profiles.dto.js";
import { ProfilesService } from "./profiles.service.js";

@Controller("profiles")
export class ProfilesController {
  constructor(@Inject(ProfilesService) private readonly profiles: ProfilesService) {}

  @UseGuards(AuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthPrincipal) {
    return this.profiles.getMe(user.userId);
  }

  @UseGuards(AuthGuard)
  @Get("discover")
  discover(@CurrentUser() user: AuthPrincipal, @Query() query: ProfileDirectoryQueryDto) {
    return this.profiles.listDirectory(user, query);
  }

  @UseGuards(AuthGuard)
  @Get("me/interactions")
  interactions(@CurrentUser() user: AuthPrincipal) {
    return this.profiles.getInteractions(user.userId);
  }

  @UseGuards(AuthGuard)
  @Patch("me/interactions/:type/:targetId")
  setInteraction(
    @CurrentUser() user: AuthPrincipal,
    @Param("type") type: string,
    @Param("targetId") targetId: string,
    @Body() dto: ProfileInteractionDto,
  ) {
    return this.profiles.setInteraction(user, type, targetId, dto.active);
  }

  @UseGuards(AuthGuard)
  @Patch("me")
  update(@CurrentUser() user: AuthPrincipal, @Body() dto: UpdateProfileDto) {
    return this.profiles.update(user.userId, dto);
  }

  @UseGuards(AuthGuard)
  @Post("me/social-accounts")
  upsertSocial(@CurrentUser() user: AuthPrincipal, @Body() dto: SocialAccountDto) {
    return this.profiles.upsertSocialAccount(user.userId, dto);
  }

  @UseGuards(AuthGuard)
  @Post("me/social-accounts/:accountId/verify")
  verifySocial(
    @CurrentUser() user: AuthPrincipal,
    @Param("accountId") accountId: string,
    @Body() dto: ContentVerificationDto,
  ) {
    return this.profiles.requestSocialVerification(user.userId, accountId, dto);
  }

  @UseGuards(AuthGuard)
  @Post("me/social-accounts/:accountId/sync")
  syncSocial(@CurrentUser() user: AuthPrincipal, @Param("accountId") accountId: string) {
    return this.profiles.syncSocialAccount(user.userId, accountId);
  }

  @UseGuards(AuthGuard)
  @Get("admin/social-reviews")
  adminSocialReviews(@CurrentUser() user: AuthPrincipal, @Query("take") take?: string, @Query("offset") offset?: string) {
    this.assertAdmin(user);
    const parsedTake = take === undefined ? 25 : Number(take);
    const parsedOffset = offset === undefined ? 0 : Number(offset);
    if (!Number.isInteger(parsedTake) || parsedTake < 1 || parsedTake > 100) throw new BadRequestException("take must be between 1 and 100");
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) throw new BadRequestException("offset must be a non-negative integer");
    return this.profiles.listSocialReviews(parsedTake, parsedOffset);
  }

  @UseGuards(AuthGuard)
  @Patch("admin/social-reviews/:accountId")
  reviewSocialAccount(@CurrentUser() user: AuthPrincipal, @Param("accountId", new ParseUUIDPipe()) accountId: string, @Body() dto: ReviewSocialAccountDto) {
    this.assertAdmin(user);
    return this.profiles.reviewSocialAccount(accountId, user.userId);
  }

  @UseGuards(AuthGuard)
  @Get(":userId")
  public(@CurrentUser() user: AuthPrincipal, @Param("userId") userId: string) {
    return this.profiles.getPublic(userId, user.userId);
  }

  @UseGuards(AuthGuard)
  @Get("admin/content-verifications")
  adminVerifications(@CurrentUser() user: AuthPrincipal, @Query("status") status?: "PENDING" | "VERIFIED" | "REJECTED") {
    this.assertAdmin(user);
    return this.profiles.listVerifications(status);
  }

  @UseGuards(AuthGuard)
  @Patch("admin/content-verifications/:id")
  reviewVerification(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body() dto: ReviewContentVerificationDto,
  ) {
    this.assertAdmin(user);
    return this.profiles.reviewVerification(id, dto.status, dto.reviewerNote);
  }

  private assertAdmin(user: AuthPrincipal): void {
    if (user.role !== "ADMIN") throw new ForbiddenException("Admin access required");
  }
}
