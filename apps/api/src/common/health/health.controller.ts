import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { RedisService } from "../cache/redis.service.js";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  @Get("live")
  live() {
    return { status: "ok", service: "api", timestamp: new Date().toISOString() };
  }

  @Get("ready")
  async ready() {
    const [database, redis] = await Promise.all([
      this.prisma.checkConnection().then(() => "ok" as const).catch(() => "unavailable" as const),
      this.redis.ping(),
    ]);

    if (database !== "ok") {
      throw new ServiceUnavailableException({
        status: "unavailable",
        checks: { database, redis },
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: "ok",
      checks: { database, redis },
      timestamp: new Date().toISOString(),
    };
  }
}
