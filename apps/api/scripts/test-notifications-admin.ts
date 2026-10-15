import assert from "node:assert/strict";
import { NotificationsService, notificationPreferenceForType } from "../src/modules/notifications/notifications.service.js";
import { formatBrandlyEmail, formatBrandlyWhatsApp } from "../src/common/notification-templates.js";

const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
assert.equal(notificationPreferenceForType("CHAT_MESSAGE"), "messages");
assert.equal(notificationPreferenceForType("CAMPAIGN_UPDATE"), "proposalUpdates");
assert.equal(notificationPreferenceForType("TASK_UPDATED"), "taskUpdates");
assert.equal(notificationPreferenceForType("TASK_REMINDER"), null, "per-reminder settings remain the control for scheduled reminders");
let storedPreferences: Record<string, boolean> | null = null;
const preferencesService = new NotificationsService({ user: {
  findUnique: async () => ({ notificationPreferences: storedPreferences }),
  update: async ({ data }: any) => { storedPreferences = data.notificationPreferences; return {}; },
} } as any, {} as any, {} as any);
assert.deepEqual(await preferencesService.getPreferences(ids[0]), { messages: true, profileActivity: true, proposalUpdates: true, taskUpdates: true });
const savedPreferences = { messages: false, profileActivity: true, proposalUpdates: false, taskUpdates: true };
assert.deepEqual(await preferencesService.savePreferences(ids[0], savedPreferences), savedPreferences);
assert.deepEqual(await preferencesService.getPreferences(ids[0]), savedPreferences, "preferences persist per user and default safely when unset");
const records: Array<Record<string, any>> = [];
const prisma = {
  user: { findMany: async ({ where }: any) => ids.filter((id) => where.id.in.includes(id)).map((id) => ({ id })), findUnique: async () => ({ notificationPreferences: null }) },
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
  completedRecipients: [{ userId: ids[0], notificationId: "notification-0" }, { userId: ids[1], notificationId: "notification-1" }],
  delivery: { delivered: 0, accepted: 0, pending: 0, failed: 2 },
});
assert(records.every((item) => item.deliveryStatus === "FAILED" && item.lastDeliveryError === "No registered push device"));

const emailTemplate = formatBrandlyEmail({ title: "<Account update>", body: "Please review & confirm.\nThank you.", actionLabel: "Review now", actionUrl: "https://brandly.example/review" });
assert.match(emailTemplate.html, /BRANDLY/);
assert.match(emailTemplate.html, /&lt;Account update&gt;/);
assert.match(emailTemplate.html, /Please review &amp; confirm\.<br \/>Thank you\./);
assert.match(emailTemplate.html, /href="https:\/\/brandly\.example\/review"/);
assert.doesNotMatch(formatBrandlyEmail({ title: "Update", body: "Review", actionLabel: "Open", actionUrl: "javascript:alert(1)" }).html, /javascript:/i);
assert.match(formatBrandlyWhatsApp({ title: "Account update", body: "Please review.", actionLabel: "Open", actionUrl: "https://brandly.example/review" }), /🔔 Brandly[\s\S]*Account update[\s\S]*Open: https:\/\/brandly\.example\/review[\s\S]*Brandly Team/);

const sentEmail: unknown[][] = [];
const sentWhatsApp: unknown[][] = [];
const channelRows: Array<Record<string, any>> = [];
const channelService = new NotificationsService({
  user: {
    findMany: async () => [{ id: ids[0] }],
    findUnique: async () => ({ email: "member@example.test", phoneE164: "+15555550100", profile: { displayName: "Member" }, notificationPreferences: null }),
  },
  deviceToken: { findMany: async () => [] },
  notification: {
    create: async ({ data }: any) => { const row = { id: `channel-${channelRows.length}`, ...data, readAt: null, deliveryStatus: data.channel === "IN_APP" ? "DELIVERED" : "PENDING", deliveryAttempts: 0 }; if (data.channel === "IN_APP") row.deliveredAt = new Date(); channelRows.push(row); return row; },
    update: async ({ where, data }: any) => { const row = channelRows.find((item) => item.id === where.id)!; Object.assign(row, data); return row; },
    findUnique: async () => null,
    findMany: async ({ where }: any) => channelRows.filter((item) => where.id.in.includes(item.id)),
  },
} as any, { sendMessage: async (...args: unknown[]) => { sentWhatsApp.push(args); } } as any, { sendNotification: async (...args: unknown[]) => { sentEmail.push(args); } } as any);
await channelService.sendBulk({ userIds: [ids[0]], type: "ADMIN_ANNOUNCEMENT", title: "Account update", body: "Please review.", channels: ["IN_APP", "EMAIL", "WHATSAPP"], data: { actionLabel: "Review now", actionUrl: "https://brandly.example/review" } });
assert.equal(channelRows.find((item) => item.channel === "IN_APP")?.data.brandName, "Brandly");
assert.equal((sentEmail[0][4] as any).actionUrl, "https://brandly.example/review");
assert.match(String(sentWhatsApp[0][1]), /🔔 Brandly/);
assert.match(String(sentWhatsApp[0][1]), /Review now: https:\/\/brandly\.example\/review/);

let inAppRecord: Record<string, any> | undefined;
const inAppService = new NotificationsService({
  user: { findUnique: async () => ({ notificationPreferences: null }) },
  notification: {
    create: async ({ data }: any) => { inAppRecord = { id: "notification-in-app", ...data }; return inAppRecord; },
    findMany: async () => inAppRecord ? [inAppRecord] : [],
  },
  deviceToken: { findMany: async () => { throw new Error("in-app notification must not call push delivery"); } },
} as any, {} as any, {} as any);
await inAppService.create(ids[0], { type: "ADMIN_ANNOUNCEMENT", title: "Brandly", body: "An in-app notice", channels: ["IN_APP"] });
assert.equal(inAppRecord?.channel, "IN_APP");
assert.equal(inAppRecord?.provider, "IN_APP");
assert.equal(inAppRecord?.deliveryStatus, "DELIVERED");
assert.ok(inAppRecord?.deliveredAt instanceof Date, "in-app notices are durably available without sending a push");

let inboxWhere: Record<string, unknown> | undefined;
const inboxService = new NotificationsService({ notification: { findMany: async ({ where }: any) => { inboxWhere = where; return []; } } } as any, {} as any, {} as any);
await inboxService.list(ids[0]);
assert.deepEqual(inboxWhere, { userId: ids[0], NOT: { type: "CHAT_MESSAGE", channel: "PUSH" } }, "chat push records stay out of the in-app inbox");

await service.sendBulk({ userIds: [ids[0]], type: "SOCIAL_VERIFICATION", title: "Instagram needs an update", body: "@creator: please submit public proof.", data: { socialPlatform: "Instagram", socialHandle: "@creator" }, channels: ["PUSH"] });
const socialNotification = records.at(-1)!;
assert.equal(socialNotification.type, "SOCIAL_VERIFICATION");
assert.equal(socialNotification.data.type, "SOCIAL_VERIFICATION");
assert.equal(socialNotification.data.socialHandle, "@creator");

let mutedPushCreated = false;
const mutedService = new NotificationsService({
  user: { findUnique: async () => ({ notificationPreferences: { messages: false, profileActivity: true, proposalUpdates: true, taskUpdates: true } }) },
  notification: { create: async () => { mutedPushCreated = true; } },
} as any, {} as any, {} as any);
assert.deepEqual(await mutedService.create(ids[0], { type: "CHAT_MESSAGE", title: "Chat", body: "Muted", channels: ["PUSH"] }), []);
assert.equal(mutedPushCreated, false, "muted chat preferences prevent persisting and sending push alerts");

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

let capturedPushPayload: any[] = [];
let mediaNotification: Record<string, any> | undefined;
const mediaService = new NotificationsService({
  user: { findUnique: async () => ({ notificationPreferences: null }) },
  deviceToken: { findMany: async () => [
    { token: "ExpoPushToken[android-device]", platform: "android" },
    { token: "ExpoPushToken[ios-device]", platform: "ios" },
  ] },
  notification: {
    findUnique: async () => null,
    create: async ({ data }: any) => (mediaNotification = { id: "notification-media", ...data, deliveryStatus: "PENDING" }),
    update: async ({ data }: any) => Object.assign(mediaNotification!, data),
    findMany: async () => mediaNotification ? [mediaNotification] : [],
  },
} as any, {} as any, {} as any);
try {
  globalThis.fetch = (async (_url, init) => {
    capturedPushPayload = JSON.parse(String(init?.body));
    return { ok: true, status: 200, json: async () => ({ data: [
      { status: "ok", id: "android-ticket" },
      { status: "ok", id: "ios-ticket" },
    ] }) } as Response;
  }) as typeof fetch;
  await mediaService.create(ids[0], {
    type: "CHAT_MESSAGE",
    title: "Creator",
    body: "Here is the brief",
    data: { type: "CHAT_MESSAGE", mediaUri: "https://cdn.example.test/brief.png", mediaType: "image", mediaName: "brief.png" },
    channels: ["PUSH"],
  });
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(mediaNotification?.body, "Here is the brief · 📷 brief.png", "chat notification keeps the message description and adds an image cue/name");
assert.deepEqual(capturedPushPayload[0].richContent, { image: "https://cdn.example.test/brief.png" }, "Android push includes the remote image preview");
assert.equal(capturedPushPayload[1].richContent, undefined, "iOS does not receive unsupported image rich content without a notification service extension");

capturedPushPayload = [];
const fileService = new NotificationsService({
  user: { findUnique: async () => ({ notificationPreferences: null }) },
  deviceToken: { findMany: async () => [{ token: "ExpoPushToken[android-device]", platform: "android" }] },
  notification: {
    findUnique: async () => null,
    create: async ({ data }: any) => ({ id: "notification-file", ...data, deliveryStatus: "PENDING" }),
    update: async ({ data }: any) => data,
    findMany: async () => [],
  },
} as any, {} as any, {} as any);
try {
  globalThis.fetch = (async (_url, init) => {
    capturedPushPayload = JSON.parse(String(init?.body));
    return { ok: true, status: 200, json: async () => ({ data: [{ status: "ok", id: "file-ticket" }] }) } as Response;
  }) as typeof fetch;
  await fileService.create(ids[0], {
    type: "CHAT_MESSAGE",
    title: "Creator",
    body: "1 attachment",
    data: { type: "CHAT_MESSAGE", mediaUri: "https://cdn.example.test/brief.pdf", mediaType: "file", mediaName: "brief.pdf" },
    channels: ["PUSH"],
  });
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(capturedPushPayload[0].body, "📎 brief.pdf", "file push identifies its attachment with an icon and filename");
assert.equal(capturedPushPayload[0].richContent, undefined, "files are not presented as image previews");

const beforeInvalidRequest = records.length;
await assert.rejects(() => service.sendBulk({
  userIds: ["33333333-3333-4333-8333-333333333333"],
  type: "ADMIN_ANNOUNCEMENT",
  title: "No recipient",
  body: "No send should happen",
  channels: ["PUSH"],
}));
assert.equal(records.length, beforeInvalidRequest, "inactive or missing recipients must not receive a partial bulk send");

let capturedLogQuery: any;
const logDate = new Date("2026-10-15T08:00:00.000Z");
const logService = new NotificationsService({
  notification: {
    findMany: async (args: any) => {
      if (args.distinct) return [{ type: "ADMIN_ANNOUNCEMENT" }, { type: "CHAT_MESSAGE" }, { type: "SOCIAL_VERIFICATION" }];
      capturedLogQuery = args;
      return [{
        id: "log-chat", userId: ids[0], user: { id: ids[0], email: "member@example.test", profile: { displayName: "Member" } },
        type: "CHAT_MESSAGE", channel: "PUSH", title: "New message", body: "Please see the photo",
        data: { adminChat: "true", mediaUri: "https://cdn.example.test/photo.jpg", mediaType: "image", mediaName: "photo.jpg", actionLabel: "Open", actionUrl: "javascript:alert(1)" },
        createdAt: logDate, readAt: null, deliveryStatus: "DELIVERED", deliveredAt: logDate, lastDeliveryError: null,
      }];
    },
    count: async ({ where }: any) => { assert.deepEqual(where.AND.map((part: any) => Object.keys(part)[0]), ["type", "channel", "OR"]); return 41; },
  },
} as any, {} as any, {} as any);
const logPage = await logService.adminLogs({ take: "10", offset: "20", search: "member", type: "CHAT_MESSAGE", channel: "PUSH" });
assert.equal(capturedLogQuery.skip, 20, "notification history uses server-side offset pagination");
assert.equal(capturedLogQuery.take, 10, "notification history applies the requested page size");
assert.equal(logPage.total, 41);
assert.deepEqual(logPage.types, ["ADMIN_ANNOUNCEMENT", "CHAT_MESSAGE", "SOCIAL_VERIFICATION"], "filters can select every stored notification type");
assert.equal(logPage.items[0].adminChat, true, "admin chat notifications expose the chat action");
assert.equal(logPage.items[0].mediaUri, "https://cdn.example.test/photo.jpg", "notification attachments are included in the log projection");
assert.equal(logPage.items[0].mediaName, "photo.jpg");
assert.equal(logPage.items[0].actionUrl, undefined, "unsafe action links are omitted from logs");

console.log("Admin notification delivery assertions passed.");
