import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { RedisService } from "../../common/cache/redis.service.js";
import type { WebSocket } from "ws";

type ClientSocket = WebSocket & { userId?: string };
type RealtimeEnvelope = { userId: string; event: Record<string, unknown> };

const CHAT_EVENTS_CHANNEL = "brandly:chat:events:v1";

@Injectable()
export class ChatRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly sockets = new Map<string, Set<ClientSocket>>();
  private subscriber: ReturnType<RedisService["createBlockingClient"]>;

  constructor(@Inject(RedisService) private readonly redis: RedisService) {
    this.subscriber = redis.createBlockingClient();
  }

  async onModuleInit() {
    if (!this.subscriber) return;
    try {
      await this.subscriber.connect();
      await this.subscriber.subscribe(CHAT_EVENTS_CHANNEL);
      this.subscriber.on("message", (_channel, raw) => {
        try {
          const envelope = JSON.parse(raw) as Partial<RealtimeEnvelope>;
          if (typeof envelope.userId !== "string" || !envelope.event || typeof envelope.event !== "object") return;
          this.deliverLocal(envelope.userId, envelope.event);
        } catch {
          // Ignore malformed cross-instance events; the persisted REST state remains authoritative.
        }
      });
    } catch {
      this.subscriber.disconnect();
      this.subscriber = null;
    }
  }

  async onModuleDestroy() {
    if (!this.subscriber) return;
    if (this.subscriber.status === "ready" || this.subscriber.status === "connecting") await this.subscriber.quit();
    else this.subscriber.disconnect();
  }

  add(userId: string, socket: ClientSocket) {
    const userSockets = this.sockets.get(userId) ?? new Set<ClientSocket>();
    userSockets.add(socket);
    this.sockets.set(userId, userSockets);
  }

  remove(userId: string, socket: ClientSocket) {
    const userSockets = this.sockets.get(userId);
    if (!userSockets) return;
    userSockets.delete(socket);
    if (!userSockets.size) this.sockets.delete(userId);
  }

  isConnected(userId: string) {
    return Boolean(this.sockets.get(userId)?.size);
  }

  send(userId: string, event: Record<string, unknown>) {
    const publisher = this.redis.getClient();
    if (publisher && this.subscriber?.status === "ready") {
      void this.publish(publisher, { userId, event });
      return;
    }
    this.deliverLocal(userId, event);
  }

  expireUserSession(userId: string, reason: string) {
    this.send(userId, { type: "account.suspended", reason });
  }

  private async publish(publisher: NonNullable<ReturnType<RedisService["getClient"]>>, envelope: RealtimeEnvelope) {
    try {
      if (await this.redis.connect()) {
        await publisher.publish(CHAT_EVENTS_CHANNEL, JSON.stringify(envelope));
        return;
      }
    } catch {
      // Fall through to the local socket path when Redis is temporarily unavailable.
    }
    this.deliverLocal(envelope.userId, envelope.event);
  }

  private deliverLocal(userId: string, event: Record<string, unknown>) {
    const payload = JSON.stringify(event);
    for (const socket of this.sockets.get(userId) ?? []) {
      if (socket.readyState !== 1) continue;
      try { socket.send(payload); }
      catch { this.remove(userId, socket); }
    }
  }
}
