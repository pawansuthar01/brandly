import { jwtVerify } from "jose";
import type { FastifyRequest } from "fastify";

export async function rateLimitKey(request: FastifyRequest, secret?: string): Promise<string> {
  const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (secret && token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
      if (payload.sub && ["BRAND", "CREATOR", "ADMIN"].includes(String(payload.role))) return `user:${payload.sub}`;
    } catch { /* Unauthenticated requests keep the existing IP limit. */ }
  }
  return `ip:${request.ip}`;
}
