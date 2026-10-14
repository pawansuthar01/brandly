import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { jwtVerify } from "jose";
import type { FastifyRequest } from "fastify";
import type { AuthPrincipal } from "./auth.types.js";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService, @Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) throw new UnauthorizedException("Sign in required");
    const secret = this.config.get<string>("JWT_ACCESS_SECRET");
    if (!secret) throw new UnauthorizedException("Authentication is not configured");

    let verified;
    try {
      verified = await jwtVerify<{ role?: AuthPrincipal["role"] }>(
        authorization.slice("Bearer ".length),
        new TextEncoder().encode(secret),
        { algorithms: ["HS256"] },
      );
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
    const subject = verified.payload.sub;
    const role = verified.payload.role;
    if (!subject || (role !== "BRAND" && role !== "CREATOR" && role !== "ADMIN")) throw new UnauthorizedException("Invalid authentication claims");
    if (role !== "ADMIN") {
      const user = await this.prisma.user.findUnique({ where: { id: subject }, select: { role: true, status: true, suspensionReason: true } });
      if (!user || user.role !== role || user.status !== "ACTIVE") {
        if (user?.status === "SUSPENDED") throw new UnauthorizedException({ code: "ACCOUNT_SUSPENDED", message: "Your account is suspended", reason: user.suspensionReason || "Your account was suspended by the Brandly team." });
        throw new UnauthorizedException("Account is not active");
      }
    }
    request.auth = { userId: subject, role };
    return true;
  }
}
