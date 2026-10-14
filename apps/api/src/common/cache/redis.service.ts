import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis | null;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const configuredUrl = config.get<string>("REDIS_URL");
    const timeoutValue = Number(config.get<string | number>("REDIS_CONNECT_TIMEOUT_MS") ?? 10_000);
    const connectTimeout = Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : 10_000;
    // ioredis also reads URL query values. Removing timeout query parameters
    // prevents a string such as connectTimeout=10000 from reaching Node's
    // Socket#setTimeout, which rejects string durations on Node 22+.
    let url = configuredUrl;
    if (configuredUrl) {
      try {
        const parsed = new URL(configuredUrl);
        parsed.searchParams.delete("connectTimeout");
        parsed.searchParams.delete("connect_timeout");
        url = parsed.toString();
      } catch {
        url = configuredUrl;
      }
    }
    this.client = url
      ? new Redis(url, {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout,
          retryStrategy: (attempt: number) => Math.min(attempt * 100, 1_000),
        })
      : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  getClient(): Redis | null {
    return this.client;
  }

  createBlockingClient(): Redis | null {
    return this.client?.duplicate() ?? null;
  }

  async connect(): Promise<boolean> {
    if (!this.client) return false;
    try {
      if (this.client.status === "wait") await this.client.connect();
      return this.client.status === "ready";
    } catch {
      this.client.disconnect();
      return false;
    }
  }

  async ping(): Promise<"ok" | "disabled" | "unavailable"> {
    if (!this.client) return "disabled";

    try {
      if (this.client.status === "wait") await this.client.connect();
      if (this.client.status === "end" || this.client.status === "close") return "unavailable";
      await this.client.ping();
      return "ok";
    } catch {
      return "unavailable";
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    if (this.client.status === "ready" || this.client.status === "connecting") {
      await this.client.quit();
    } else {
      this.client.disconnect();
    }
  }
}
