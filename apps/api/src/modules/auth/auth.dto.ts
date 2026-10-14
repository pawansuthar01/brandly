import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+?[0-9 ()-]{10,20}$/)
  phone!: string;

  @IsIn(["signin", "signup"])
  intent!: "signin" | "signup";

  @IsOptional()
  @IsIn(["BRAND", "CREATOR"])
  role?: "BRAND" | "CREATOR";

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  signupToken?: string;
}

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class VerifyOtpDto {
  @IsString()
  challengeId!: string;

  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;

  @IsOptional()
  @IsIn(["BRAND", "CREATOR"])
  role?: "BRAND" | "CREATOR";

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  signupToken?: string;
}

export class RefreshTokenDto {
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}

export class RequestEmailOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\+?[0-9 ()-]{10,20}$/)
  phone!: string;

  @IsIn(["signup"])
  intent!: "signup";

  @IsIn(["BRAND", "CREATOR"])
  role!: "BRAND" | "CREATOR";
}

export class VerifyEmailOtpDto {
  @IsString()
  challengeId!: string;

  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;

  @IsEmail()
  email!: string;

  @IsString()
  signupToken!: string;
}

export class RequestEmailSigninOtpDto {
  @IsEmail()
  email!: string;
}

export class VerifyEmailSigninOtpDto {
  @IsString()
  challengeId!: string;

  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;

  @IsEmail()
  email!: string;
}

export class ReactivationRequestDto {
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  token!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;
}
