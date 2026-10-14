import { Inject, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WebSocketGateway } from "@nestjs/websockets";
import { jwtVerify } from "jose";
import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import { ChatRealtimeService } from "./chat.realtime.js";
import { PrismaService } from "../../common/database/prisma.service.js";

type AuthenticatedSocket = WebSocket & { userId?: string };

@WebSocketGateway({ path: "/chat/socket" })
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ChatRealtimeService) private readonly realtime: ChatRealtimeService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: AuthenticatedSocket, request: IncomingMessage) {
    const token = this.tokenFromRequest(request);
    const secret = this.config.get<string>("JWT_ACCESS_SECRET");
    if (!token || !secret) {
      socket.close(1008, "Authentication required");
      return;
    }
    try {
      const { payload } = await jwtVerify<{ role?: string }>(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
      if (typeof payload.sub !== "string" || !["BRAND", "CREATOR", "ADMIN"].includes(String(payload.role))) throw new Error("Invalid claims");
      if (payload.role !== "ADMIN") {
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true, status: true } });
        if (!user || user.status !== "ACTIVE" || user.role !== payload.role) {
          socket.close(1008, user?.status === "SUSPENDED" ? "Account suspended" : "Account inactive");
          return;
        }
      }
      socket.userId = payload.sub;
      this.realtime.add(payload.sub, socket);
      socket.send(JSON.stringify({ type: "ready", userId: payload.sub }));
      socket.on("close", () => this.realtime.remove(payload.sub as string, socket));
    } catch {
      socket.close(1008, "Invalid or expired access token");
    }
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    if (socket.userId) this.realtime.remove(socket.userId, socket);
  }

  private tokenFromRequest(request: IncomingMessage) {
    try {
      const url = new URL(request.url ?? "/", "ws://brandly.local");
      return url.searchParams.get("accessToken");
    } catch (error) {
      this.logger.debug(`Invalid websocket URL: ${String(error)}`);
      return null;
    }
  }
}
