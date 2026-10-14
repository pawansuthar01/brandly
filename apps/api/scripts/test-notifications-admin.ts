import assert from "node:assert/strict";
import { NotificationsService } from "../src/modules/notifications/notifications.service.js";

const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const records: Array<Record<string, any>> = [];
const prisma = {
  user: { findMany: async ({ where }: any) => ids.filter((id) => where.id.in.includes(id)).map((id) => ({ id })) },
  deviceToken: { findMany: async () => [] },
  notification: {
    create: async ({ data }: any) => {
      const row = { id: `notification-${records.length}`, ...data, readAt: null, deliveredAt: null, deliveryStatus: "PENDING", deliveryAttempts: 0 };
      records.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = records.find((item) => item.id === where.id)!;
      Object.assign(row, data);
      if (data.deliveryAttempts?.increment) row.deliveryAttempts = data.deliveryAttempts.increment;
      return row;
    },
    findMany: async ({ where }: any) => records.filter((item) => where.id.in.includes(item.id)),
    findUnique: async () => null,
  },
} as any;

const service = new NotificationsService(prisma, {} as any, {} as any);
const result = await service.sendBulk({
  userIds: ids,
  type: "ADMIN_ANNOUNCEMENT",
  title: "Service notice",
  body: "A local test notification",
  channels: ["PUSH"],
});

assert.deepEqual(result, {
  requested: 2,
  completed: 2,
  failed: 0,
  delivery: { delivered: 0, accepted: 0, pending: 0, failed: 2 },
});
assert(records.every((item) => item.deliveryStatus === "FAILED" && item.lastDeliveryError === "No registered push device"));

const invalidDeviceTokens: string[][] = [];
let failedTicketUpdates: Array<Record<string, unknown>> = [];
const receiptAwareService = new NotificationsService({
  deviceToken: {
    findMany: async () => [{ token: "ExpoPushToken[invalid-device]", platform: "android" }],
    deleteMany: async ({ where }: any) => { invalidDeviceTokens.push(where.token.in); return { count: where.token.in.length }; },
  },
  notification: {
    update: async ({ data }: any) => { failedTicketUpdates.push(data); return data; },
  },
} as any, {} as any, {} as any);
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: [{ status: "error", message: "Unregistered", details: { error: "DeviceNotRegistered" } }] }),
  }) as Response) as typeof fetch;
  await (receiptAwareService as any).deliverExpoPush("notification-invalid", ids[0], "Title", "Body");
} finally {
  globalThis.fetch = originalFetch;
}
assert.deepEqual(invalidDeviceTokens, [["ExpoPushToken[invalid-device]"]], "Expo must remove tokens rejected as DeviceNotRegistered in the initial ticket response");
assert.equal(failedTicketUpdates.at(-1)?.deliveryStatus, "FAILED");

const beforeInvalidRequest = records.length;
await assert.rejects(() => service.sendBulk({
  userIds: ["33333333-3333-4333-8333-333333333333"],
  type: "ADMIN_ANNOUNCEMENT",
  title: "No recipient",
  body: "No send should happen",
  channels: ["PUSH"],
}));
assert.equal(records.length, beforeInvalidRequest, "inactive or missing recipients must not receive a partial bulk send");

console.log("Admin notification delivery assertions passed.");
