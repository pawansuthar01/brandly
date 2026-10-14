import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { AuthService } from "./auth.service.js";
import { AdminLoginDto, ReactivationRequestDto, RefreshTokenDto, RequestEmailOtpDto, RequestEmailSigninOtpDto, RequestOtpDto, VerifyEmailOtpDto, VerifyEmailSigninOtpDto, VerifyOtpDto } from "./auth.dto.js";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("otp/request")
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Post("admin/login")
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto);
  }

  @Post("email-otp/request")
  requestEmailOtp(@Body() dto: RequestEmailOtpDto) {
    return this.auth.requestEmailOtp(dto);
  }

  @Post("email-otp/verify")
  verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    return this.auth.verifyEmailOtp(dto);
  }

  @Post("email-otp/signin/request")
  requestEmailSigninOtp(@Body() dto: RequestEmailSigninOtpDto) {
    return this.auth.requestEmailSigninOtp(dto);
  }

  @Post("email-otp/signin/verify")
  verifyEmailSigninOtp(@Body() dto: VerifyEmailSigninOtpDto) {
    return this.auth.verifyEmailSigninOtp(dto);
  }

  @Post("otp/verify")
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Post("reactivation-requests")
  requestReactivation(@Body() dto: ReactivationRequestDto) {
    return this.auth.requestReactivation(dto);
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto);
  }

  @UseGuards(AuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthPrincipal) {
    return this.auth.me(user.userId);
  }

  @UseGuards(AuthGuard)
  @Post("logout")
  logout(@CurrentUser() user: AuthPrincipal, @Body() dto: RefreshTokenDto) {
    return this.auth.logout(user.userId, dto.refreshToken);
  }
}
