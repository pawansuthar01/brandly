import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { Redis } from "ioredis";
import { PrismaService } from "../../common/database/prisma.service.js";
import { RedisService } from "../../common/cache/redis.service.js";

const QUEUE_KEY = "brandly:social-profile-sync";
const LOCK_PREFIX = "brandly:social-profile-sync:lock:";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const WORKER_BLOCK_SECONDS = 5;
const MAX_HTML_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 12_000;

const PLATFORM_HOSTS: Record<string, string[]> = {
  Instagram: ["instagram.com"],
  YouTube: ["youtube.com", "youtu.be"],
  Threads: ["threads.net"],
  Snapchat: ["snapchat.com"],
  Facebook: ["facebook.com"],
  LinkedIn: ["linkedin.com"],
  X: ["x.com", "twitter.com"],
  Pinterest: ["pinterest.com"],
  Twitch: ["twitch.tv"],
  Reddit: ["reddit.com"],
  Discord: ["discord.com", "discord.gg"],
  Medium: ["medium.com"],
  Behance: ["behance.net"],
};

type SocialProfileSnapshot = {
  displayName: string | null;
  followerCount: number | null;
  followingCount: number | null;
  postCount: number | null;
  profileImageUrl: string | null;
  title: string | null;
  description: string | null;
  fetchedUrl: string;
};

const decodeEntities = (value: string): string => value
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;/g, " ")
  .trim();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function readMeta(html: string, key: string): string | null {
  const escapedKey = escapeRegExp(key);
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([^"']*)`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escapedKey}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

function parseCount(value: string | null): number | null {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);
  if (!match) return null;
  const multiplier = match[2]?.toUpperCase() === "B" ? 1_000_000_000 : match[2]?.toUpperCase() === "M" ? 1_000_000 : match[2]?.toUpperCase() === "K" ? 1_000 : 1;
  const count = Math.round(Number(match[1]) * multiplier);
  return Number.isSafeInteger(count) ? count : null;
}

function findCount(description: string | null, labels: string[]): number | null {
  if (!description) return null;
  const label = labels.join("|");
  return parseCount(description.match(new RegExp(`([\\d.,]+\\s*[KMB]?)\\s+(?:${label})\\b`, "i"))?.[1] ?? null);
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").trim();
}

function nameMatches(expected: string | null | undefined, actual: string | null): boolean {
  const expectedName = normalizeName(expected);
  const actualName = normalizeName(actual);
  return Boolean(expectedName && actualName && expectedName === actualName);
}

function isAllowedHost(hostname: string, allowedHosts: string[]): boolean {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return allowedHosts.some((host) => normalized === host || normalized.endsWith(`.${host}`));
}

function validateProfileUrl(platform: string, value: string): URL {
  const url = new URL(value.trim());
  const allowedHosts = PLATFORM_HOSTS[platform];
  if (!allowedHosts || url.protocol !== "https:" || !isAllowedHost(url.hostname, allowedHosts)) {
    throw new Error("This public profile URL is not supported for automatic verification.");
  }
  url.hash = "";
  return url;
}

function snapshotFromHtml(platform: string, url: string, html: string): SocialProfileSnapshot {
  const title = readMeta(html, "og:title") ?? readMeta(html, "twitter:title");
  const description = readMeta(html, "og:description") ?? readMeta(html, "description");
  const image = readMeta(html, "og:image") ?? readMeta(html, "twitter:image");
  const fromName = description?.match(/\bfrom\s+(.+?)\s+\(@[^)]+\)/i)?.[1]?.trim();
  const titleName = title
    ?.replace(/\s*[|·-]\s*(YouTube|Instagram|Threads|Twitch|Reddit|Pinterest|Facebook|LinkedIn|X)\s*$/i, "")
    .trim();
  const displayName = fromName || (platform === "YouTube" ? titleName : null);
  return {
    displayName: displayName || null,
    followerCount: findCount(description, ["followers", "subscribers"]),
    followingCount: findCount(description, ["following"]),
    postCount: findCount(description, ["posts", "videos", "threads"]),
    profileImageUrl: image,
    title,
    description,
    fetchedUrl: url,
  };
}

@Injectable()
export class SocialProfileSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocialProfileSyncService.name);
  private running = true;
  private blockingClient: Redis | null;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {
    this.blockingClient = redis.createBlockingClient();
  }

  onModuleInit(): void {
    this.refreshTimer = setInterval(() => void this.enqueueStaleAccounts(), 15 * 60 * 1_000);
    void this.enqueueStaleAccounts();
    void this.runWorker();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.blockingClient?.disconnect();
  }

  async enqueue(accountId: string): Promise<void> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: { platform: true, verifications: { where: { status: "PENDING" }, select: { id: true }, take: 1 } },
    });
    if (!account || !this.supportsPlatform(account.platform) || account.verifications.length) return;
    await this.prisma.socialAccount.update({
      where: { id: accountId },
      data: { syncStatus: "QUEUED", syncError: null, verificationStatus: "PENDING" },
    });
    const client = this.redis.getClient();
    if (!client) {
      void this.syncAccount(accountId);
      return;
    }
    try {
      await this.redis.connect();
      await client.lpush(QUEUE_KEY, accountId);
    } catch (error) {
      await this.markFailed(accountId, error instanceof Error ? error.message : "Sync queue unavailable");
    }
  }

  supportsPlatform(platform: string): boolean {
    return Boolean(PLATFORM_HOSTS[platform]);
  }

  async enqueueStaleAccounts(userId?: string): Promise<void> {
    const cutoff = new Date(Date.now() - REFRESH_INTERVAL_MS);
    const accounts = await this.prisma.socialAccount.findMany({
      where: {
        ...(userId ? { userId } : {}),
        profileUrl: { not: null },
        syncStatus: { not: "RUNNING" },
        verifications: { none: { status: "PENDING" } },
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
      },
      select: { id: true, platform: true },
      take: 100,
    });
    await Promise.all(accounts.filter(({ platform }) => this.supportsPlatform(platform)).map(({ id }) => this.enqueue(id)));
  }

  async syncAccount(accountId: string) {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
      include: { user: { include: { profile: true } } },
    });
    if (!account) return null;
    await this.prisma.socialAccount.update({ where: { id: accountId }, data: { syncStatus: "RUNNING", syncError: null } });
    try {
      const profileUrl = validateProfileUrl(account.platform, account.profileUrl ?? account.handle);
      const { html, finalUrl } = await this.fetchHtml(account.platform, profileUrl);
      const snapshot = snapshotFromHtml(account.platform, finalUrl, html);
      const matches = nameMatches(account.user.profile?.displayName, snapshot.displayName);
      const next = await this.prisma.socialAccount.update({
        where: { id: accountId },
        data: {
          displayName: snapshot.displayName,
          followerCount: snapshot.followerCount,
          followingCount: snapshot.followingCount,
          postCount: snapshot.postCount,
          profileImageUrl: snapshot.profileImageUrl,
          profileMetadata: {
            source: "public-profile-html",
            title: snapshot.title,
            description: snapshot.description,
            fetchedUrl: snapshot.fetchedUrl,
            nameMatch: matches,
          },
          syncStatus: matches ? "SYNCED" : "FAILED",
          syncError: matches ? null : snapshot.displayName ? "Public profile name does not match your Brandly profile name." : "Public profile name was not available on this page.",
          lastSyncedAt: new Date(),
          followerCountVerifiedAt: null,
          verificationMethod: matches ? "PUBLIC_PROFILE_MATCH" : null,
          verificationStatus: matches ? "VERIFIED" : "PENDING",
          verifiedAt: matches ? new Date() : null,
        },
      });
      return next;
    } catch (error) {
      await this.markFailed(accountId, error instanceof Error ? error.message : "Public profile could not be synced");
      return null;
    }
  }

  private async fetchHtml(platform: string, initialUrl: URL): Promise<{ html: string; finalUrl: string }> {
    let current = initialUrl;
    for (let redirect = 0; redirect < 4; redirect += 1) {
      const response = await fetch(current, {
        redirect: "manual",
        headers: { accept: "text/html,application/xhtml+xml", "user-agent": "BrandlySocialSync/1.0" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Public profile redirect was invalid.");
        current = validateProfileUrl(platform, new URL(location, current).toString());
        continue;
      }
      if (!response.ok) throw new Error(`Public profile returned HTTP ${response.status}.`);
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        throw new Error("Public profile did not return readable page data.");
      }
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_HTML_BYTES) throw new Error("Public profile response is too large.");
      if (!response.body) return { html: await response.text(), finalUrl: current.toString() };
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > MAX_HTML_BYTES) {
          await reader.cancel();
          throw new Error("Public profile response is too large.");
        }
        chunks.push(chunk.value);
      }
      return { html: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8"), finalUrl: current.toString() };
    }
    throw new Error("Public profile redirected too many times.");
  }

  private async markFailed(accountId: string, message: string): Promise<void> {
    const account = await this.prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        syncStatus: "FAILED",
        syncError: message.slice(0, 500),
        lastSyncedAt: new Date(),
        followerCountVerifiedAt: null,
        verificationStatus: "PENDING",
      },
    }).catch(() => null);
    if (!account?.profileUrl) return;
    const existingReview = await this.prisma.contentVerification.findFirst({
      where: { socialAccountId: account.id, status: "PENDING" },
      select: { id: true },
    });
    if (!existingReview) {
      await this.prisma.contentVerification.create({
        data: {
          userId: account.userId,
          socialAccountId: account.id,
          contentType: "profile",
          contentUrl: account.profileUrl,
        },
      }).catch(() => undefined);
    }
  }

  private async runWorker(): Promise<void> {
    if (!this.blockingClient) return;
    try {
      await this.redis.connect();
      if (this.blockingClient.status === "wait") await this.blockingClient.connect();
      while (this.running) {
        const item = await this.blockingClient.brpop(QUEUE_KEY, WORKER_BLOCK_SECONDS);
        const accountId = item?.[1];
        if (!accountId) continue;
        const client = this.redis.getClient();
        if (!client) continue;
        const lockKey = `${LOCK_PREFIX}${accountId}`;
        if ((await client.set(lockKey, "1", "EX", 300, "NX")) !== "OK") continue;
        try {
          await this.syncAccount(accountId);
        } catch (error) {
          this.logger.warn(`Social sync failed for ${accountId}: ${error instanceof Error ? error.message : "unknown error"}`);
          await this.markFailed(accountId, "Social profile sync failed.");
        } finally {
          await client.del(lockKey).catch(() => undefined);
        }
      }
    } catch (error) {
      this.logger.warn(`Social sync worker stopped: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
}
