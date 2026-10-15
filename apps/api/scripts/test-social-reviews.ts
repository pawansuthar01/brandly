import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { validate } from "class-validator";
import { ProfilesService } from "../src/modules/profiles/profiles.service.js";
import { ReviewSocialAccountDto } from "../src/modules/profiles/profiles.dto.js";
import { freshVerifiedFollowerCount } from "../src/modules/campaigns/campaigns.service.js";

const userId = "10000000-0000-4000-8000-000000000001";
const adminId = "20000000-0000-4000-8000-000000000002";
const accountId = "30000000-0000-4000-8000-000000000003";
const checkedAt = new Date();
assert.equal(freshVerifiedFollowerCount([{ verificationStatus: "VERIFIED", syncStatus: "FAILED", followerCount: 5_000, lastSyncedAt: null, followerCountVerifiedAt: checkedAt }]), 5_000, "a recently admin-checked follower count qualifies without claiming scraper sync");
assert.equal(freshVerifiedFollowerCount([{ verificationStatus: "VERIFIED", syncStatus: "FAILED", followerCount: 5_000, lastSyncedAt: null, followerCountVerifiedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1_000) }]), 5_000, "manual counts remain useful for 30 days");
assert.equal(freshVerifiedFollowerCount([{ verificationStatus: "VERIFIED", syncStatus: "FAILED", followerCount: 5_000, lastSyncedAt: null, followerCountVerifiedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1_000) }]), 0, "manual counts expire after 30 days");
const account = { id: accountId, userId, platform: "Instagram", handle: "@creator", verificationStatus: "PENDING" };
const saved: Array<Record<string, unknown>> = [];
const cards: Array<Record<string, unknown>> = [];
const userRow = { id: userId, role: "CREATOR", status: "ACTIVE", email: "creator@example.test", createdAt: new Date("2026-10-01T00:00:00.000Z"), profile: { displayName: "Creator", city: "Jaipur", avatarUrl: null }, socialAccounts: [
  { platform: "Instagram", syncStatus: "SYNCED", syncError: null, createdAt: new Date("2026-10-02T00:00:00.000Z") },
  { platform: "YouTube", syncStatus: "FAILED", syncError: "Profile is private", createdAt: new Date("2026-10-03T00:00:00.000Z") },
] };
const detailedAccount = { id: accountId, platform: "Instagram", handle: "@creator", profileUrl: "https://social.example/@creator", displayName: "Creator", followerCount: 1200, followingCount: 300, postCount: 24, profileImageUrl: null, syncStatus: "SYNCED", syncError: null, verificationStatus: "PENDING", createdAt: new Date("2026-10-02T00:00:00.000Z"), verifications: [{ id: "40000000-0000-4000-8000-000000000004", contentType: "post", contentUrl: "https://social.example/post/1", createdAt: new Date("2026-10-04T00:00:00.000Z") }] };
let updateCount = 1;
const tx = {
  socialAccount: {
    findUnique: async () => account,
    updateMany: async ({ where, data }: { where: unknown; data: unknown }) => { saved.push({ where, data }); return { count: updateCount }; },
  },
  contentVerification: { updateMany: async ({ where, data }: { where: unknown; data: unknown }) => { saved.push({ where, data }); return { count: 1 }; } },
};
const prisma = {
  socialAccount: {
    findMany: async (query: unknown) => { saved.push({ listQuery: query }); return []; },
    findFirst: async () => account,
    update: async () => account,
  },
  contentVerification: {
    findFirst: async () => null,
    create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "40000000-0000-4000-8000-000000000004", ...data }),
  },
  user: { findMany: async (query: unknown) => { saved.push({ groupedQuery: query }); return [userRow]; }, findFirst: async () => ({ ...userRow, phoneE164: null, profile: { ...userRow.profile, bio: "Creator profile", profileCompleted: 80 }, socialAccounts: [detailedAccount] }) },
  $transaction: async (work: (value: typeof tx) => Promise<unknown>) => work(tx),
};
let notifications = 0;
const notificationInputs: Array<Record<string, unknown>> = [];
const service = new ProfilesService(prisma as never, {} as never, { create: async (_userId: string, input: Record<string, unknown>) => { notifications++; notificationInputs.push(input); return []; } } as never, { sendSocialReviewCard: async (principal: unknown, card: Record<string, unknown>) => { cards.push({ principal, card }); } } as never);

assert.ok((await validate(Object.assign(new ReviewSocialAccountDto(), { status: "REJECTED" }))).length, "admin social-review API must not allow rejection");
assert.ok((await validate(Object.assign(new ReviewSocialAccountDto(), { status: "VERIFIED", followerCount: -1 }))).length, "reviewed follower counts cannot be negative");
assert.ok((await validate(Object.assign(new ReviewSocialAccountDto(), { status: "VERIFIED", followerCount: 100_000_001 }))).length, "reviewed follower counts have a bounded integer range");

await service.listSocialReviews(25, 50);
const listQuery = saved[0]?.listQuery as { where: { verificationStatus: string }; skip: number; take: number };
assert.equal(listQuery.where.verificationStatus, "PENDING");
assert.equal(listQuery.skip, 50);
assert.equal(listQuery.take, 26);

const grouped = await service.listSocialReviewUsers(10, 0, "creator");
assert.equal(grouped.items.length, 1, "a user with multiple pending accounts appears once");
assert.equal(grouped.items[0].pendingCount, 2);
assert.deepEqual(grouped.items[0].platforms, ["Instagram", "YouTube"]);
assert.equal(grouped.items[0].needsAttention, true);
assert.equal((saved[1]?.groupedQuery as { skip: number; take: number }).take, 11);
const details = await service.getAdminSocialReviewUser(userId);
assert.equal(details.accounts.length, 1);
assert.equal(details.accounts[0].contentRequest?.contentUrl, "https://social.example/post/1");

await service.requestSocialVerification(userId, "CREATOR" as never, accountId, { contentType: "post", contentUrl: "https://social.example/post/1" } as never);
assert.equal(cards.length, 1, "social proof submission creates a support-chat review card");
assert.deepEqual(cards[0].card, { requestId: "40000000-0000-4000-8000-000000000004", accountId, platform: "Instagram", handle: "@creator", contentType: "post", contentUrl: "https://social.example/post/1" });

const result = await service.reviewSocialAccount(accountId, adminId, 5000);
assert.equal(result.notificationQueued, true);
assert.equal(result.followerCount, 5000);
assert.equal(notifications, 1);
assert.deepEqual(notificationInputs[0]?.data, { screen: "Notifications", socialPlatform: "Instagram", socialAccountId: accountId, socialHandle: "@creator", verificationStatus: "VERIFIED" });
const reviewWrite = saved.find((item) => "data" in item)?.data as Record<string, unknown>;
assert.equal(reviewWrite.reviewedBy, adminId);
assert.equal(reviewWrite.reviewerNote, null);
assert.equal(reviewWrite.verificationStatus, "VERIFIED");
assert.equal(reviewWrite.followerCount, 5000);
assert.ok(reviewWrite.followerCountVerifiedAt instanceof Date, "the reviewed count gets its own freshness timestamp without pretending a scraper sync happened");

updateCount = 0;
await assert.rejects(service.reviewSocialAccount(accountId, adminId), (error) => error instanceof ConflictException);
assert.equal(notifications, 1, "a concurrent duplicate decision must not notify twice");
console.log("Social review pagination, audit, notification, and concurrent-decision assertions passed.");
