import type { FastifyRequest } from "fastify";

export type AuthPrincipal = {
  userId: string;
  role: "BRAND" | "CREATOR" | "ADMIN";
};

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthPrincipal;
  }
}

export function requirePrincipal(request: FastifyRequest): AuthPrincipal {
  if (!request.auth) throw new Error("Authenticated principal is missing");
  return request.auth;
}
