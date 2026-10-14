import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, UserRole } from "@prisma/client";
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import { PrismaService } from "../../common/database/prisma.service.js";
import { WhatsAppOtpService } from "../../common/auth/whatsapp-otp.service.js";
import { SmtpOtpService } from "../../common/auth/smtp-otp.service.js";
import type { AdminLoginDto, ReactivationRequestDto, RefreshTokenDto, RequestEmailOtpDto, RequestEmailSigninOtpDto, RequestOtpDto, VerifyEmailOtpDto, VerifyEmailSigninOtpDto, VerifyOtpDto } from "./auth.dto.js";

const scryptAsync = promisify(scrypt);
const challengeLifetimeMs = 5 * 60 * 1000;
const otpResendCooldownMs = 55_000;
const signupTokenLifetimeSeconds = 10 * 60;
const accessLifetimeSeconds = 60 * 60;
// Admin web sessions are intentionally longer lived than mobile access tokens.
const adminAccessLifetimeSeconds = 30 * 24 * 60 * 60;
const refreshLifetimeMs = 90 * 24 * 60 * 60 * 1000;
const userWithProfile = { profile: true, socialAccounts: true } as const;
type UserWithProfile = Prisma.UserGetPayload<{ include: typeof userWithProfile }>;

type SignupTokenClaims = {
  email: string;
  phone: string;
  role: "BRAND" | "CREATOR";
  emailChallengeId: string;
  emailVerified?: boolean;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: ReturnType<AuthService["serializeUser"]>;
};
export type SuspendedAuthResponse = { suspended: true; reason: string; reactivationToken: string; userName: string; reviewStatus?: "PENDING" | "REJECTED"; resolutionNote?: string | null };

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  throw new UnauthorizedException("Enter a valid phone number");
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 4)}••••${phone.slice(-2)}`;
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function hashCode(code: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(code, salt, 32)) as Buffer;
  return `${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

async function verifyCode(code: string, encoded: string): Promise<boolean> {
  const [saltEncoded, digestEncoded] = encoded.split(":");
  if (!saltEncoded || !digestEncoded) return false;
  const derived = (await scryptAsync(code, Buffer.from(saltEncoded, "base64url"), 32)) as Buffer;
  const expected = Buffer.from(digestEncoded, "base64url");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(WhatsAppOtpService) private readonly whatsapp: WhatsAppOtpService,
    @Inject(SmtpOtpService) private readonly smtp: SmtpOtpService,
  ) {}

  private authSigningKey(): Uint8Array {
    const secret = this.config.get<string>("JWT_ACCESS_SECRET");
    if (!secret) throw new UnauthorizedException("Authentication is not configured");
    return new TextEncoder().encode(secret);
  }

  private async createSignupToken(claims: SignupTokenClaims): Promise<string> {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("brandly-signup")
      .setAudience("brandly-signup")
      .setSubject(claims.email)
      .setIssuedAt()
      .setExpirationTime(`${signupTokenLifetimeSeconds}s`)
      .sign(this.authSigningKey());
  }

  private async readSignupToken(token: string, requireEmailVerified = true): Promise<SignupTokenClaims> {
    try {
      const { payload } = await jwtVerify<SignupTokenClaims>(token, this.authSigningKey(), {
        issuer: "brandly-signup",
        audience: "brandly-signup",
      });
      if (
        typeof payload.email !== "string" ||
        typeof payload.phone !== "string" ||
        (payload.role !== "BRAND" && payload.role !== "CREATOR") ||
        typeof payload.emailChallengeId !== "string" ||
        (requireEmailVerified && payload.emailVerified !== true)
      ) {
        throw new Error("Invalid signup token");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Your signup verification session has expired. Please verify your email again.");
    }
  }

  async requestEmailOtp(dto: RequestEmailOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const phone = normalizePhone(dto.phone);
    const now = new Date();
    const recent = await this.prisma.authChallenge.findFirst({
      where: {
        destination: email,
        channel: "EMAIL",
        purpose: "SIGN_UP",
        consumedAt: null,
        createdAt: { gte: new Date(now.getTime() - otpResendCooldownMs) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent) throw new HttpException("Please wait before requesting another code", HttpStatus.TOO_MANY_REQUESTS);

    const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
    const existingByPhone = await this.prisma.user.findUnique({ where: { phoneE164: phone } });
    if (existingByEmail && existingByPhone && existingByEmail.id !== existingByPhone.id) {
      throw new ConflictException("This email and phone belong to different accounts");
    }
    const user = existingByEmail ?? existingByPhone;
    if (user && user.status !== "ACTIVE" && user.status !== "PENDING_VERIFICATION") {
      throw new UnauthorizedException("This account is not active");
    }
    if (user?.role && user.role !== dto.role) throw new ConflictException("This account belongs to another role");
    if (user?.emailVerifiedAt && user?.phoneVerifiedAt) {
      throw new ConflictException("An account already exists for these details");
    }

    const code = String(randomInt(100000, 1000000));
    const challenge = await this.prisma.authChallenge.create({
      data: {
        destination: email,
        channel: "EMAIL",
        purpose: "SIGN_UP",
        codeHash: await hashCode(code),
        expiresAt: new Date(now.getTime() + challengeLifetimeMs),
        requestId: randomBytes(16).toString("hex"),
      },
    });
    try {
      await this.smtp.send(email, code, challenge.requestId);
    } catch (error) {
      await this.prisma.authChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
      throw error;
    }
    const signupToken = await this.createSignupToken({
      email,
      phone,
      role: dto.role,
      emailChallengeId: challenge.id,
    });
    return {
      challengeId: challenge.id,
      expiresIn: challengeLifetimeMs / 1000,
      resendAfterSeconds: otpResendCooldownMs / 1000,
      destination: email,
      channel: "email" as const,
      signupToken,
    };
  }

  async verifyEmailOtp(dto: VerifyEmailOtpDto): Promise<{ emailVerified: boolean; signupToken: string }> {
    const email = dto.email.trim().toLowerCase();
    const challenge = await this.prisma.authChallenge.findUnique({ where: { id: dto.challengeId } });
    if (!challenge || challenge.channel !== "EMAIL" || challenge.purpose !== "SIGN_UP" || challenge.consumedAt || challenge.expiresAt <= new Date()) {
      throw new UnauthorizedException("This email verification code has expired");
    }
    const signup = await this.readSignupToken(dto.signupToken, false);
    if (signup.emailChallengeId !== challenge.id || signup.email !== email || signup.emailVerified) {
      throw new UnauthorizedException("This verification request is invalid");
    }
    if (challenge.userId || challenge.destination !== email) throw new UnauthorizedException("This verification request is invalid");
    if (challenge.attempts >= 5) throw new HttpException("Too many incorrect attempts", HttpStatus.TOO_MANY_REQUESTS);
    if (!(await verifyCode(dto.code, challenge.codeHash))) {
      await this.prisma.authChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException("Incorrect verification code");
    }
    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.authChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (!claimed.count) throw new UnauthorizedException("This verification code has already been used");
    });
    return {
      emailVerified: true,
      signupToken: await this.createSignupToken({ ...signup, emailVerified: true }),
    };
  }

  async requestEmailSigninOtp(dto: RequestEmailSigninOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const now = new Date();
    const recent = await this.prisma.authChallenge.findFirst({
      where: {
        destination: email,
        channel: "EMAIL",
        purpose: "SIGN_IN",
        consumedAt: null,
        createdAt: { gte: new Date(now.getTime() - otpResendCooldownMs) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent) throw new HttpException("Please wait before requesting another code", HttpStatus.TOO_MANY_REQUESTS);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || (user.status !== "ACTIVE" && user.status !== "SUSPENDED") || !user.emailVerifiedAt || !user.phoneVerifiedAt) {
      throw new UnauthorizedException("No fully verified account found for this email");
    }
    const code = String(randomInt(100000, 1000000));
    const challenge = await this.prisma.authChallenge.create({
      data: {
        userId: user.id,
        destination: email,
        channel: "EMAIL",
        purpose: "SIGN_IN",
        codeHash: await hashCode(code),
        expiresAt: new Date(now.getTime() + challengeLifetimeMs),
        requestId: randomBytes(16).toString("hex"),
      },
    });
    try {
      await this.smtp.send(email, code, challenge.requestId);
    } catch (error) {
      await this.prisma.authChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
      throw error;
    }
    return {
      challengeId: challenge.id,
      expiresIn: challengeLifetimeMs / 1000,
      resendAfterSeconds: otpResendCooldownMs / 1000,
      destination: email,
      channel: "email" as const,
    };
  }

  async verifyEmailSigninOtp(dto: VerifyEmailSigninOtpDto): Promise<AuthResponse | SuspendedAuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const challenge = await this.prisma.authChallenge.findUnique({ where: { id: dto.challengeId } });
    if (!challenge || challenge.channel !== "EMAIL" || challenge.purpose !== "SIGN_IN" || challenge.consumedAt || challenge.expiresAt <= new Date()) {
      throw new UnauthorizedException("This email verification code has expired");
    }
    if (!challenge.userId || challenge.destination !== email) throw new UnauthorizedException("This verification request is invalid");
    if (challenge.attempts >= 5) throw new HttpException("Too many incorrect attempts", HttpStatus.TOO_MANY_REQUESTS);
    if (!(await verifyCode(dto.code, challenge.codeHash))) {
      await this.prisma.authChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException("Incorrect verification code");
    }
    const user = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.authChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (!claimed.count) throw new UnauthorizedException("This verification code has already been used");
      return transaction.user.findUniqueOrThrow({ where: { id: challenge.userId as string }, include: userWithProfile });
    });
    return user.status === "SUSPENDED" ? this.suspendedLogin(user) : this.issueTokens(user);
  }

  async requestOtp(dto: RequestOtpDto) {
    const phone = normalizePhone(dto.phone);
    const purpose = dto.intent === "signup" ? "SIGN_UP" : "SIGN_IN";
    const now = new Date();
    const recent = await this.prisma.authChallenge.findFirst({
      where: {
        destination: phone,
        purpose,
        consumedAt: null,
        createdAt: { gte: new Date(now.getTime() - otpResendCooldownMs) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent) throw new HttpException("Please wait before requesting another code", HttpStatus.TOO_MANY_REQUESTS);

    let user = await this.prisma.user.findUnique({ where: { phoneE164: phone } });
    if (dto.intent === "signup") {
      if (!dto.role) throw new ConflictException("Choose Brand or Creator before signing up");
      if (!dto.email || !dto.signupToken) throw new ConflictException("Verify your email before requesting a WhatsApp code");
      const email = dto.email.trim().toLowerCase();
      const signup = await this.readSignupToken(dto.signupToken);
      if (signup.email !== email || signup.phone !== phone || signup.role !== dto.role) {
        throw new ConflictException("This verification session does not match the signup details");
      }
      const emailChallenge = await this.prisma.authChallenge.findUnique({ where: { id: signup.emailChallengeId } });
      if (!emailChallenge || emailChallenge.channel !== "EMAIL" || emailChallenge.purpose !== "SIGN_UP" || !emailChallenge.consumedAt) {
        throw new ConflictException("Verify your email before requesting a WhatsApp code");
      }
      const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
      if (existingByEmail && user && existingByEmail.id !== user.id) {
        throw new ConflictException("This email and phone belong to different accounts");
      }
      user = existingByEmail ?? user;
      if (user && user.status !== "ACTIVE" && user.status !== "PENDING_VERIFICATION") {
        throw new UnauthorizedException("This account is not active");
      }
      if (user?.role && user.role !== dto.role) throw new ConflictException("This account belongs to another role");
      if (user?.emailVerifiedAt && user?.phoneVerifiedAt) throw new ConflictException("An account already exists for these details");
    } else if (!user) {
      throw new UnauthorizedException("No account found for this phone");
    } else if (user.status !== "ACTIVE" && user.status !== "SUSPENDED") {
      throw new UnauthorizedException("This account is not active");
    } else if (!user.phoneVerifiedAt || !user.emailVerifiedAt) {
      throw new UnauthorizedException("Both email and phone must be verified");
    } else if (dto.email && user.email && user.email !== dto.email.trim().toLowerCase()) {
      throw new UnauthorizedException("The email does not match this phone number");
    }

    const code = String(randomInt(100000, 1000000));
    const challenge = await this.prisma.authChallenge.create({
      data: {
        userId: dto.intent === "signin" ? user?.id : undefined,
        destination: phone,
        channel: "WHATSAPP",
        purpose,
        codeHash: await hashCode(code),
        expiresAt: new Date(now.getTime() + challengeLifetimeMs),
        requestId: randomBytes(16).toString("hex"),
      },
    });

    try {
      await this.whatsapp.send(phone, code, challenge.requestId);
    } catch (error) {
      await this.prisma.authChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
      throw error;
    }

    return {
      challengeId: challenge.id,
      expiresIn: challengeLifetimeMs / 1000,
      resendAfterSeconds: otpResendCooldownMs / 1000,
      destination: maskPhone(phone),
      channel: "whatsapp" as const,
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse | SuspendedAuthResponse> {
    const challenge = await this.prisma.authChallenge.findUnique({ where: { id: dto.challengeId } });
    if (!challenge || challenge.channel !== "WHATSAPP" || challenge.consumedAt || challenge.expiresAt <= new Date()) {
      throw new UnauthorizedException("This verification code has expired");
    }
    const signup = challenge.purpose === "SIGN_UP" ? await this.readSignupToken(dto.signupToken ?? "") : null;
    if (signup) {
      const email = dto.email?.trim().toLowerCase();
      const emailChallenge = await this.prisma.authChallenge.findUnique({ where: { id: signup.emailChallengeId } });
      if (
        challenge.userId ||
        !email ||
        !dto.role ||
        !emailChallenge?.consumedAt ||
        signup.email !== email ||
        signup.phone !== challenge.destination ||
        signup.role !== dto.role
      ) {
        throw new UnauthorizedException("Both email and phone must be verified before creating the account");
      }
    } else if (!challenge.userId) {
      throw new UnauthorizedException("This verification request is invalid");
    }
    const userId = challenge.userId;
    if (challenge.attempts >= 5) throw new HttpException("Too many incorrect attempts", HttpStatus.TOO_MANY_REQUESTS);
    if (!(await verifyCode(dto.code, challenge.codeHash))) {
      await this.prisma.authChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException("Incorrect verification code");
    }

    let createdNewAccount = false;
    const user = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.authChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, ...(signup ? { userId: null } : {}) },
        data: { consumedAt: new Date() },
      });
      if (!claimed.count) throw new UnauthorizedException("This verification code has already been used");
      if (signup) {
        const existingByEmail = await transaction.user.findUnique({ where: { email: signup.email } });
        const existingByPhone = await transaction.user.findUnique({ where: { phoneE164: signup.phone } });
        if (existingByEmail && existingByPhone && existingByEmail.id !== existingByPhone.id) {
          throw new ConflictException("This email and phone belong to different accounts");
        }
        const existing = existingByEmail ?? existingByPhone;
        if (existing?.emailVerifiedAt && existing.phoneVerifiedAt) {
          throw new ConflictException("An account already exists for these details");
        }
        if (existing && existing.status !== "ACTIVE" && existing.status !== "PENDING_VERIFICATION") {
          throw new UnauthorizedException("This account is not active");
        }
        if (existing?.role && existing.role !== signup.role) {
          throw new ConflictException("This account belongs to another role");
        }
        const verifiedAt = new Date();
        const account = existing
          ? await transaction.user.update({
              where: { id: existing.id },
              data: {
                email: signup.email,
                phoneE164: signup.phone,
                role: signup.role,
                status: "ACTIVE",
                emailVerifiedAt: existing.emailVerifiedAt ?? verifiedAt,
                phoneVerifiedAt: verifiedAt,
                onboardingCompletedAt: null,
              },
              include: userWithProfile,
            })
          : await (() => {
              createdNewAccount = true;
              return transaction.user.create({
                data: {
                  email: signup.email,
                  phoneE164: signup.phone,
                  role: signup.role,
                  status: "ACTIVE",
                  emailVerifiedAt: verifiedAt,
                  phoneVerifiedAt: verifiedAt,
                  profile: { create: { displayName: dto.displayName?.trim() || "New member" } },
                },
                include: userWithProfile,
              });
            })();
        if (dto.displayName) {
          await transaction.userProfile.upsert({
            where: { userId: account.id },
            create: { userId: account.id, displayName: dto.displayName.trim() },
            update: { displayName: dto.displayName.trim() },
          });
        }
        await transaction.authChallenge.update({ where: { id: challenge.id }, data: { userId: account.id } });
        return transaction.user.findUniqueOrThrow({ where: { id: account.id }, include: userWithProfile });
      }
      if (!userId) throw new UnauthorizedException("This verification request is invalid");
      const existing = await transaction.user.findUnique({ where: { id: userId } });
      if (!existing || (challenge.purpose === "SIGN_UP"
        ? (existing.status !== "PENDING_VERIFICATION" && existing.status !== "ACTIVE")
        : existing.status !== "ACTIVE" && existing.status !== "SUSPENDED")) {
        throw new UnauthorizedException("This account is not active");
      }
      if (dto.role && existing.role !== dto.role) throw new ConflictException("This account belongs to another role");
      if (challenge.purpose === "SIGN_UP" && !existing.emailVerifiedAt) {
        throw new ConflictException("Verify your email before verifying your phone");
      }
      if (challenge.purpose === "SIGN_IN" && (!existing.phoneVerifiedAt || !existing.emailVerifiedAt)) {
        throw new UnauthorizedException("Both email and phone must be verified");
      }
      if (challenge.purpose === "SIGN_UP" && dto.email && existing.email !== dto.email.trim().toLowerCase()) {
        throw new ConflictException("This email does not match the verified signup");
      }
      if (challenge.purpose === "SIGN_IN" && existing.status === "SUSPENDED") return transaction.user.findUniqueOrThrow({ where: { id: userId }, include: userWithProfile });
      await transaction.user.update({
        where: { id: userId },
        data: {
          status: challenge.purpose === "SIGN_UP" ? "ACTIVE" : undefined,
          phoneVerifiedAt: new Date(),
          email: dto.email?.trim().toLowerCase() || undefined,
        },
      });
      if (dto.displayName) {
        await transaction.userProfile.upsert({
          where: { userId },
          create: { userId, displayName: dto.displayName.trim() },
          update: { displayName: dto.displayName.trim() },
        });
      }
      return transaction.user.findUniqueOrThrow({ where: { id: userId }, include: userWithProfile });
    });
    if (signup && createdNewAccount) {
      try {
        await this.notifyAdminsOfNewAccount(user);
      } catch (error) {
        this.logger.warn(`New-account notification failed: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }
    return user.status === "SUSPENDED" ? this.suspendedLogin(user) : this.issueTokens(user);
  }

  private async suspendedLogin(user: UserWithProfile): Promise<SuspendedAuthResponse> {
    const secret = this.config.get<string>("JWT_ACCESS_SECRET");
    if (!secret) throw new UnauthorizedException("Authentication is not configured");
    const reactivationToken = await new SignJWT({ purpose: "ACCOUNT_REACTIVATION" })
      .setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("15m")
      .sign(new TextEncoder().encode(secret));
    const previous = await this.prisma.accountReactivationRequest.findFirst({ where: { userId: user.id, status: { in: ["PENDING", "REJECTED"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { status: true, resolutionNote: true } });
    return { suspended: true, reason: user.suspensionReason || "Your account was suspended by the Brandly team. You can request a review below.", reactivationToken, userName: user.profile?.displayName || user.email || "Your account", ...(previous && previous.status !== "APPROVED" ? { reviewStatus: previous.status, resolutionNote: previous.resolutionNote } : {}) };
  }

  async requestReactivation(dto: ReactivationRequestDto) {
    const secret = this.config.get<string>("JWT_ACCESS_SECRET");
    if (!secret) throw new UnauthorizedException("Authentication is not configured");
    let userId: string;
    try {
      const verified = await jwtVerify<{ purpose?: string }>(dto.token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
      if (verified.payload.purpose !== "ACCOUNT_REACTIVATION" || !verified.payload.sub) throw new Error("Invalid purpose");
      userId = verified.payload.sub;
    } catch { throw new UnauthorizedException("This reactivation session expired. Sign in again to request a review."); }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true, role: true } });
    if (!user || user.status !== "SUSPENDED") throw new UnauthorizedException("This account is no longer suspended");
    try {
      const request = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.accountReactivationRequest.create({ data: { userId, message: dto.message.trim() } });
        const thread = await tx.adminChatConversation.upsert({ where: { userId }, create: { userId }, update: {} });
        await tx.adminChatMessage.create({
          data: { conversationId: thread.id, senderId: userId, senderRole: user.role, clientMessageId: `reactivation:${saved.id}`, text: `[ACCOUNT REACTIVATION REQUEST]\n${dto.message.trim()}` },
        });
        await tx.adminChatConversation.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
        return saved;
      });
      return { id: request.id, status: request.status, createdAt: request.createdAt };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const pending = await this.prisma.accountReactivationRequest.findFirst({ where: { userId, status: "PENDING" }, select: { id: true, status: true, createdAt: true } });
        if (pending) return pending;
      }
      throw error;
    }
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponse> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(dto.refreshToken) },
      include: { user: { include: userWithProfile } },
    });
    if (!record || record.revokedAt || record.expiresAt <= new Date() || record.user.status !== "ACTIVE") {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!claimed.count) throw new UnauthorizedException("Refresh token is invalid or expired");
    return this.issueTokens(record.user);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return;
    }
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: userWithProfile });
    if (!user || user.status !== "ACTIVE") throw new UnauthorizedException("Account is not active");
    return this.serializeUser(user);
  }

  async adminLogin(dto: AdminLoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const isProduction = this.config.get<string>("NODE_ENV") === "production";
    const accounts = [
      {
        email: (this.config.get<string>("ADMIN_OWNER_EMAIL") || (isProduction ? "" : "owner@brandly.demo")).trim().toLowerCase(),
        password: this.config.get<string>("ADMIN_OWNER_PASSWORD") || (isProduction ? "" : "admin123"),
        role: "Owner" as const,
      },
      {
        email: (this.config.get<string>("ADMIN_MODERATOR_EMAIL") || (isProduction ? "" : "moderator@brandly.demo")).trim().toLowerCase(),
        password: this.config.get<string>("ADMIN_MODERATOR_PASSWORD") || (isProduction ? "" : "mod12345"),
        role: "Moderator" as const,
      },
    ];
    const account = accounts.find((item) => item.email === normalizedEmail && item.password === dto.password && item.email);
    if (!account) throw new UnauthorizedException("Admin credentials are invalid");
    const accessToken = await new SignJWT({ role: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(`admin:${account.email}`)
      .setIssuedAt()
      .setExpirationTime(`${adminAccessLifetimeSeconds}s`)
      .sign(this.authSigningKey());
    return { accessToken, expiresIn: adminAccessLifetimeSeconds, email: account.email, role: account.role };
  }

  private async notifyAdminsOfNewAccount(user: UserWithProfile): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
    if (!admins.length) return;
    await this.prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        channel: "PUSH" as const,
        type: "NEW_ACCOUNT",
        title: "New account created",
        body: `${user.profile?.displayName || "New member"} joined as ${user.role === "CREATOR" ? "creator" : "brand"}.`,
        data: { accountId: user.id, role: user.role },
      })),
    });
  }

  private async issueTokens(user: UserWithProfile): Promise<AuthResponse> {
    const secret = this.config.get<string>("JWT_ACCESS_SECRET");
    if (!secret) throw new UnauthorizedException("Authentication is not configured");
    const accessToken = await new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${accessLifetimeSeconds}s`)
      .sign(new TextEncoder().encode(secret));
    const refreshToken = randomBytes(48).toString("base64url");
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshLifetimeMs),
      },
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: accessLifetimeSeconds,
      user: this.serializeUser(user),
    };
  }

  private serializeUser(user: UserWithProfile) {
    return {
      id: user.id,
      role: user.role,
      phone: user.phoneE164,
      email: user.email,
      phoneVerified: Boolean(user.phoneVerifiedAt),
      emailVerified: Boolean(user.emailVerifiedAt),
      onboardingComplete: Boolean(user.onboardingCompletedAt),
      onboardingStep: user.profile?.onboardingStep ?? "profile",
      profile: user.profile,
      socialAccounts: user.socialAccounts,
    };
  }
}
