import assert from "node:assert/strict";
import { UnauthorizedException } from "@nestjs/common";
import { SignJWT } from "jose";
import { AuthGuard } from "../src/common/auth/auth.guard.js";
import type { PrismaService } from "../src/common/database/prisma.service.js";

const secret = new TextEncoder().encode("account-suspension-test-secret-32-bytes");
const token = async (userId: string, role: "BRAND" | "CREATOR" | "ADMIN") => new SignJWT({ role })
  .setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime("5m").sign(secret);

function context(authorization: string) {
  const request: { headers: { authorization: string }; auth?: unknown } = { headers: { authorization } };
  return { request, switchToHttp: () => ({ getRequest: () => request }) };
}

async function main() {
  const config = { get: (key: string) => key === "JWT_ACCESS_SECRET" ? new TextDecoder().decode(secret) : undefined } as never;
  const suspendedGuard = new AuthGuard(config, { user: { findUnique: async () => ({ role: "CREATOR", status: "SUSPENDED", suspensionReason: "Policy violation" }) } } as unknown as PrismaService);
  await assert.rejects(suspendedGuard.canActivate(context(`Bearer ${await token("user-1", "CREATOR")}`) as never), (error: unknown) => {
    assert.ok(error instanceof UnauthorizedException);
    assert.deepEqual(error.getResponse(), { code: "ACCOUNT_SUSPENDED", message: "Your account is suspended", reason: "Policy violation" });
    return true;
  });

  const activeGuard = new AuthGuard(config, { user: { findUnique: async () => ({ role: "BRAND", status: "ACTIVE", suspensionReason: null }) } } as unknown as PrismaService);
  const activeContext = context(`Bearer ${await token("user-2", "BRAND")}`);
  assert.equal(await activeGuard.canActivate(activeContext as never), true);
  assert.deepEqual(activeContext.request.auth, { userId: "user-2", role: "BRAND" });

  let queried = false;
  const adminGuard = new AuthGuard(config, { user: { findUnique: async () => { queried = true; return null; } } } as unknown as PrismaService);
  assert.equal(await adminGuard.canActivate(context(`Bearer ${await token("admin:owner@example.test", "ADMIN")}`) as never), true);
  assert.equal(queried, false);
  console.log("Account suspension guard checks passed (suspended denial/reason, active access, admin bypass).");
}

void main();
