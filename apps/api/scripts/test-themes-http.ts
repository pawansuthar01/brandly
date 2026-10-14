import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { defaultTheme, validateTheme } from "../src/modules/themes/theme-schema.js";

const api = new URL(process.env.THEME_TEST_API_URL ?? "http://127.0.0.1:3000/v1");
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
assert.notEqual(process.env.NODE_ENV, "production", "theme HTTP checks must never run in production");
assert(localHosts.has(api.hostname), "THEME_TEST_API_URL must point to loopback");
const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
assert(localHosts.has(databaseUrl.hostname), "theme HTTP checks require a confirmed local database");

const prisma = new PrismaClient();
const scope = "mobile";
const name = `Theme HTTP check ${randomUUID()}`;
const secondDraftName = `${name} extra`;
const draftIds: string[] = [];
const testVersionIds: string[] = [];
const originalCurrent = await prisma.appThemeCurrent.findUnique({ where: { scope } });
let token = "";

async function request(path: string, init: RequestInit = {}, auth = true) {
  const response = await fetch(new URL(path.replace(/^\//, ""), `${api.href.replace(/\/$/, "")}/`), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(auth && token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = response.status === 304 ? null : await response.json().catch(() => null);
  return { response, body };
}

async function cleanup() {
  try {
    await prisma.$transaction(async (tx) => {
      const versions = testVersionIds.length
        ? await tx.appThemeVersion.findMany({ where: { id: { in: testVersionIds }, scope }, select: { id: true } })
        : [];
      const ids = versions.map((item) => item.id);
      if (ids.length) {
        const current = await tx.appThemeCurrent.findUnique({ where: { scope } });
        if (current && ids.includes(current.versionId)) {
          if (originalCurrent) await tx.appThemeCurrent.update({ where: { scope }, data: { versionId: originalCurrent.versionId, actorId: originalCurrent.actorId } });
          else await tx.appThemeCurrent.delete({ where: { scope } });
        }
        await tx.appThemeActivation.deleteMany({ where: { versionId: { in: ids } } });
        await tx.appThemeVersion.deleteMany({ where: { id: { in: ids }, scope } });
      }
      if (draftIds.length) await tx.appThemeDraft.deleteMany({ where: { id: { in: draftIds }, scope } });
    });
  } finally { await prisma.$disconnect(); }
}

try {
  const initialRead = await request("app-themes/active", {}, false);
  assert.equal(initialRead.response.status, 200, "active theme works without a published version");
  const initial = initialRead.body as { id: string; published: boolean; theme: unknown };
  assert.equal(initial.published, Boolean(originalCurrent), "active response reports bundled versus published state");
  validateTheme(initial.theme);
  const initialEtag = initialRead.response.headers.get("etag");
  assert(initialEtag, "active response includes ETag");
  assert.equal((await request("admin/themes/drafts", {}, false)).response.status, 401, "admin history is protected");

  const login = await fetch(new URL("auth/admin/login", `${api.href.replace(/\/$/, "")}/`), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.ADMIN_OWNER_EMAIL || "owner@brandly.demo", password: process.env.ADMIN_OWNER_PASSWORD || "admin123" }),
  });
  assert.equal(login.status, 201, "local admin login succeeds");
  token = (await login.json() as { accessToken: string }).accessToken;
  assert(token.length > 20, "admin login returns an access token");

  const firstTheme = structuredClone(defaultTheme);
  firstTheme.name = name;
  const create = await request("admin/themes/drafts", { method: "POST", body: JSON.stringify({ name, theme: firstTheme, changeNote: "first snapshot" }) });
  assert.equal(create.response.status, 201);
  const draft = create.body as { id: string; revision: number; document: typeof firstTheme };
  draftIds.push(draft.id);
  assert.equal(draft.revision, 1);
  const draftList = await request("admin/themes/drafts?take=1");
  assert.equal(draftList.response.status, 200);
  const draftPage = draftList.body as { items: Array<Record<string, unknown>>; nextCursor: string | null };
  assert.equal("document" in (draftPage.items[0] ?? {}), false, "draft history uses summaries");
  assert(draftPage.items.some((item) => item.id === draft.id));
  assert.deepEqual((await request(`admin/themes/drafts/${draft.id}`)).body, create.body, "draft detail is retrieved separately");
  const secondDraft = await request("admin/themes/drafts", { method: "POST", body: JSON.stringify({ name: secondDraftName, theme: { ...firstTheme, name: secondDraftName } }) });
  assert.equal(secondDraft.response.status, 201);
  const secondDraftId = (secondDraft.body as { id: string }).id;
  draftIds.push(secondDraftId);
  const concurrentEdits = await Promise.all([
    request(`admin/themes/drafts/${secondDraftId}`, { method: "PUT", body: JSON.stringify({ name: secondDraftName, theme: { ...firstTheme, name: secondDraftName }, expectedRevision: 1 }) }),
    request(`admin/themes/drafts/${secondDraftId}`, { method: "PUT", body: JSON.stringify({ name: secondDraftName, theme: { ...firstTheme, name: secondDraftName }, expectedRevision: 1 }) }),
  ]);
  assert.deepEqual(concurrentEdits.map((item) => item.response.status).sort(), [200, 409], "concurrent draft edits use revision compare-and-swap");
  const boundedDraftPage = await request("admin/themes/drafts?take=1");
  const boundedDrafts = boundedDraftPage.body as { items: Array<{ id: string }>; nextCursor: string | null };
  assert.equal(boundedDrafts.items.length, 1);
  assert(boundedDrafts.nextCursor, "draft history has a continuation cursor");
  const nextDraftPage = await request(`admin/themes/drafts?take=1&cursor=${boundedDrafts.nextCursor}`);
  assert.notEqual((nextDraftPage.body as { items: Array<{ id: string }> }).items[0]?.id, boundedDrafts.items[0]?.id, "draft cursor advances to a different page");
  assert.equal((await request(`app-themes/active`, {}, false)).body.id, initial.id, "creating a draft does not change active theme");

  const firstPublish = await request(`admin/themes/drafts/${draft.id}/publish`, { method: "POST", body: JSON.stringify({ expectedRevision: 1, changeNote: "first snapshot" }) });
  assert.equal(firstPublish.response.status, 201);
  const firstVersion = firstPublish.body as { id: string; revision: number; document: typeof firstTheme };
  testVersionIds.push(firstVersion.id);
  assert.equal(firstVersion.revision, 1);
  assert.deepEqual(firstVersion.document, firstTheme);
  const firstActive = await request("app-themes/active", {}, false);
  assert.deepEqual(firstActive.body.theme, firstTheme, "published snapshot becomes active");
  assert.notEqual(firstActive.response.headers.get("etag"), initialEtag, "publish changes the active validator");

  const secondTheme = structuredClone(firstTheme);
  secondTheme.tokens.colors.light.accent = "#B5E8D4";
  const update = await request(`admin/themes/drafts/${draft.id}`, { method: "PUT", body: JSON.stringify({ name, theme: secondTheme, changeNote: "second snapshot", expectedRevision: 1 }) });
  assert.equal(update.response.status, 200);
  const updatedDraft = update.body as { revision: number; document: typeof secondTheme };
  assert.equal(updatedDraft.revision, 2);
  assert.equal((await request("app-themes/active", {}, false)).body.id, firstVersion.id, "saving a draft does not change active theme");
  const secondPublish = await request(`admin/themes/drafts/${draft.id}/publish`, { method: "POST", body: JSON.stringify({ expectedRevision: 2, changeNote: "second snapshot" }) });
  assert.equal(secondPublish.response.status, 201);
  const secondVersion = secondPublish.body as { id: string; revision: number; document: typeof secondTheme };
  testVersionIds.push(secondVersion.id);
  assert.equal(secondVersion.revision, 2);
  const secondActive = await request("app-themes/active", {}, false);
  assert.deepEqual(secondActive.body.theme, secondTheme, "the revision previewed and published is active");
  assert.notEqual(secondActive.response.headers.get("etag"), firstActive.response.headers.get("etag"), "changed active response has a changed validator");
  const unchanged = await request("app-themes/active", { headers: { "if-none-match": secondActive.response.headers.get("etag") ?? "" } }, false);
  assert.equal(unchanged.response.status, 304, "matching ETag receives not-modified response");

  const thirdTheme = structuredClone(secondTheme);
  thirdTheme.tokens.colors.light.accent = "#D7B9F3";
  const thirdDraft = await request(`admin/themes/drafts/${draft.id}`, { method: "PUT", body: JSON.stringify({ name, theme: thirdTheme, changeNote: "concurrent publish check", expectedRevision: 2 }) });
  assert.equal((thirdDraft.body as { revision: number }).revision, 3);
  const racingPublishes = await Promise.all([
    request(`admin/themes/drafts/${draft.id}/publish`, { method: "POST", body: JSON.stringify({ expectedRevision: 3 }) }),
    request(`admin/themes/drafts/${draft.id}/publish`, { method: "POST", body: JSON.stringify({ expectedRevision: 3 }) }),
  ]);
  assert.deepEqual(racingPublishes.map((item) => item.response.status).sort(), [201, 409], "concurrent publish allows exactly one writer");
  const winningPublish = racingPublishes.find((item) => item.response.status === 201)!;
  const thirdVersion = winningPublish.body as { id: string; revision: number; document: typeof thirdTheme };
  testVersionIds.push(thirdVersion.id);
  assert.equal(thirdVersion.revision, 3);
  assert.deepEqual((await request("app-themes/active", {}, false)).body.theme, thirdTheme, "the winning concurrent revision becomes active atomically");

  const list = await request("admin/themes/versions?take=100");
  assert.equal(list.response.status, 200);
  const versionList = list.body as { items: Array<Record<string, unknown>>; nextCursor: string | null };
  assert(versionList.items.some((item) => item.id === firstVersion.id));
  assert.equal("document" in (versionList.items.find((item) => item.id === firstVersion.id) ?? {}), false, "version history uses summaries");
  const firstVersionPage = await request("admin/themes/versions?take=1");
  const firstVersionPageBody = firstVersionPage.body as { items: Array<{ id: string }>; nextCursor: string | null };
  assert(firstVersionPageBody.nextCursor, "version history has a continuation cursor");
  const nextVersionPage = await request(`admin/themes/versions?take=1&cursor=${firstVersionPageBody.nextCursor}`);
  assert.notEqual((nextVersionPage.body as { items: Array<{ id: string }> }).items[0]?.id, firstVersionPageBody.items[0]?.id, "version cursor advances to a different page");
  const retrieved = await request(`admin/themes/versions/${firstVersion.id}`);
  assert.deepEqual((retrieved.body as { document: unknown }).document, firstTheme, "saved version can be retrieved in full");

  const thirdActive = await request("app-themes/active", {}, false);
  const restore = await request(`admin/themes/versions/${firstVersion.id}/activate`, { method: "POST", body: "{}" });
  assert.equal(restore.response.status, 201);
  assert.equal((restore.body as { restored: boolean }).restored, true);
  const restoredActive = await request("app-themes/active", {}, false);
  assert.deepEqual(restoredActive.body.theme, firstTheme, "restore activates stored values");
  assert.notEqual(restoredActive.response.headers.get("etag"), thirdActive.response.headers.get("etag"), "restore changes the active validator");
  assert.deepEqual((await request(`admin/themes/versions/${firstVersion.id}`)).body, retrieved.body, "restore leaves historical snapshot unchanged");
  const audit = await request("admin/themes/activations?take=100");
  assert.equal(audit.response.status, 200);
  const auditItems = (audit.body as { items: Array<{ version: { id: string }; action: string; actorId: string; createdAt: string }> }).items;
  assert(auditItems.some((item) => item.version.id === firstVersion.id && item.action === "RESTORE" && item.actorId.startsWith("admin:") && item.createdAt));
  const firstAuditPage = await request("admin/themes/activations?take=1");
  const firstAuditPageBody = firstAuditPage.body as { items: Array<{ id: string }>; nextCursor: string | null };
  assert(firstAuditPageBody.nextCursor, "activation history has a continuation cursor");
  const nextAuditPage = await request(`admin/themes/activations?take=1&cursor=${firstAuditPageBody.nextCursor}`);
  assert.notEqual((nextAuditPage.body as { items: Array<{ id: string }> }).items[0]?.id, firstAuditPageBody.items[0]?.id, "activation cursor advances to a different page");

  console.log("Local theme HTTP flow passed: public fallback, admin authorization, paginated draft/history summaries, draft isolation, publish, ETag/304, version retrieval, concurrent publish, restore, immutable snapshot, and audit.");
} finally {
  await cleanup();
}
