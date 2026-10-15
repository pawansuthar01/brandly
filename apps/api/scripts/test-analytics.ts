import assert from "node:assert/strict";
import { AdminService } from "../src/modules/admin/admin.service.js";

const now = new Date();
const bucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
let rawQuery = 0;
const prisma = {
  user: { count: async ({ where }: { where: Record<string, any> }) => {
    if (where.role === "BRAND") return 3;
    if (where.role === "CREATOR") return 4;
    if (where.status === "ACTIVE") return 6;
    if (where.createdAt) return where.createdAt.lt ? 1 : 2;
    return 7;
  } },
  campaign: {
    count: async ({ where }: { where: Record<string, any> }) => where.createdAt.lt ? 2 : 3,
    groupBy: async ({ by }: { by: string[] }) => by[0] === "category"
      ? [{ category: "Food", _count: { _all: 2 } }]
      : [{ status: "PUBLISHED", _count: { _all: 3 } }],
  },
  campaignApplication: {
    count: async ({ where }: { where: Record<string, any> }) => where.completedAt ? 1 : where.submittedAt.lt ? 3 : 4,
    groupBy: async () => [{ status: "ACCEPTED", _count: { _all: 2 } }],
  },
  campaignPayment: { aggregate: async ({ where }: { where: Record<string, any> }) => where.paidAt.lt
    ? { _sum: { amount: 50 }, _count: { _all: 1 } }
    : { _sum: { amount: 100 }, _count: { _all: 2 } } },
  task: { count: async ({ where }: { where: Record<string, any> }) => where.completedAt ? 2 : 5 },
  chatMessage: { count: async () => 6 },
  adminChatMessage: { count: async () => 2 },
  notification: { count: async () => 5 },
  deviceToken: { count: async () => 4 },
  userProfile: { aggregate: async () => ({ _avg: { profileCompleted: 75 } }) },
  $queryRaw: async () => {
    rawQuery++;
    return rawQuery === 4 ? [{ bucket, amount: 125 }] : [{ bucket, count: 2 }];
  },
};

const service = new AdminService(prisma as never, {} as never);
const result = await service.analytics(7);
assert.equal(result.summary.totalUsers, 7);
assert.equal(result.summary.newUsers, 2);
assert.equal(result.summary.previousNewUsers, 1);
assert.equal(result.summary.paidAmount, 100);
assert.equal(result.summary.tasks, 5);
assert.equal(result.summary.completedTasks, 2);
assert.equal(result.summary.chatMessages, 8);
assert.equal(result.trends.users.length, 7, "daily trends include zero-filled days");
assert.equal(result.trends.users.at(-1)?.value, 2, "current day's aggregate is retained");
assert.equal(result.trends.payments.at(-1)?.value, 125, "payment amounts are converted to numeric trend values");
assert.deepEqual(result.breakdowns.categories, [{ label: "Food", value: 2 }]);
console.log("Analytics aggregation and zero-filled trend assertions passed.");
