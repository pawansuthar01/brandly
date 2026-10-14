import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { validate } from "class-validator";
import { ProfilesService } from "../src/modules/profiles/profiles.service.js";
import { ReviewSocialAccountDto } from "../src/modules/profiles/profiles.dto.js";

const userId = "10000000-0000-4000-8000-000000000001";
const adminId = "20000000-0000-4000-8000-000000000002";
const accountId = "30000000-0000-4000-8000-000000000003";
const account = { id: accountId, userId, platform: "Instagram", handle: "@creator", verificationStatus: "PENDING" };
const saved: Array<Record<string, unknown>> = [];
let updateCount = 1;
const tx = {
  socialAccount: {
    findUnique: async () => account,
    updateMany: async ({ where, data }: { where: unknown; data: unknown }) => { saved.push({ where, data }); return { count: updateCount }; },
  },
  contentVerification: { updateMany: async ({ where, data }: { where: unknown; data: unknown }) => { saved.push({ where, data }); return { count: 1 }; } },
};
const prisma = {
  socialAccount: { findMany: async (query: unknown) => { saved.push({ listQuery: query }); return []; } },
  $transaction: async (work: (value: typeof tx) => Promise<unknown>) => work(tx),
};
let notifications = 0;
const notificationInputs: Array<Record<string, unknown>> = [];
const service = new ProfilesService(prisma as never, {} as never, { create: async (_userId: string, input: Record<string, unknown>) => { notifications++; notificationInputs.push(input); return []; } } as never);

assert.ok((await validate(Object.assign(new ReviewSocialAccountDto(), { status: "REJECTED" }))).length, "admin social-review API must not allow rejection");

await service.listSocialReviews(25, 50);
const listQuery = saved[0]?.listQuery as { where: { verificationStatus: string }; skip: number; take: number };
assert.equal(listQuery.where.verificationStatus, "PENDING");
assert.equal(listQuery.skip, 50);
assert.equal(listQuery.take, 26);

const result = await service.reviewSocialAccount(accountId, adminId);
assert.equal(result.notificationQueued, true);
assert.equal(notifications, 1);
assert.deepEqual(notificationInputs[0]?.data, { screen: "Notifications", socialPlatform: "Instagram", verificationStatus: "VERIFIED" });
const reviewWrite = saved.find((item) => "data" in item)?.data as Record<string, unknown>;
assert.equal(reviewWrite.reviewedBy, adminId);
assert.equal(reviewWrite.reviewerNote, null);
assert.equal(reviewWrite.verificationStatus, "VERIFIED");

updateCount = 0;
await assert.rejects(service.reviewSocialAccount(accountId, adminId), (error) => error instanceof ConflictException);
assert.equal(notifications, 1, "a concurrent duplicate decision must not notify twice");
console.log("Social review pagination, audit, notification, and concurrent-decision assertions passed.");
