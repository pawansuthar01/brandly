import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { AuthPrincipal } from "./auth.types.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (!request.auth) throw new UnauthorizedException("Sign in required");
    return request.auth;
  },
);
