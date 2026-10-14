import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { CampaignsService } from "./campaigns.service.js";
import { CampaignListQueryDto, CreateCampaignApplicationDto, CreateCampaignDto, CreateCampaignReviewDto, InviteCampaignCreatorDto, UpdateCampaignApplicationDto, UpdateCampaignDto, UpdateCampaignPaymentDto } from "./campaigns.dto.js";

@Controller("campaigns")
@UseGuards(AuthGuard)
export class CampaignsController {
  constructor(@Inject(CampaignsService) private readonly campaigns: CampaignsService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: CampaignListQueryDto) { return this.campaigns.list(user, query); }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateCampaignDto) { return this.campaigns.create(user, dto); }

  @Get(":id")
  get(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) { return this.campaigns.get(user, id); }

  @Patch(":id")
  update(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: UpdateCampaignDto) { return this.campaigns.update(user, id, dto); }

  @Delete(":id")
  archive(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) { return this.campaigns.archive(user, id); }

  @Get(":id/matches")
  matches(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) { return this.campaigns.matches(user, id); }

  @Post(":id/applications")
  apply(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: CreateCampaignApplicationDto) { return this.campaigns.apply(user, id, dto); }

  @Post(":id/invitations")
  invite(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: InviteCampaignCreatorDto) { return this.campaigns.invite(user, id, dto); }

  @Patch("applications/:applicationId")
  updateApplication(@CurrentUser() user: AuthPrincipal, @Param("applicationId") applicationId: string, @Body() dto: UpdateCampaignApplicationDto) { return this.campaigns.updateApplication(user, applicationId, dto); }

  @Post("applications/:applicationId/completion")
  completeApplication(@CurrentUser() user: AuthPrincipal, @Param("applicationId") applicationId: string) { return this.campaigns.completeApplication(user, applicationId); }

  @Post("applications/:applicationId/reviews")
  createReview(@CurrentUser() user: AuthPrincipal, @Param("applicationId") applicationId: string, @Body() dto: CreateCampaignReviewDto) { return this.campaigns.createReview(user, applicationId, dto); }

  @Patch("applications/:applicationId/payment")
  updatePayment(@CurrentUser() user: AuthPrincipal, @Param("applicationId") applicationId: string, @Body() dto: UpdateCampaignPaymentDto) { return this.campaigns.updatePayment(user, applicationId, dto); }
}
