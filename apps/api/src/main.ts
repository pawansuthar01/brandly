import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { WsAdapter } from "@nestjs/platform-ws";
import { AppModule } from "./app.module.js";
import { RedisService } from "./common/cache/redis.service.js";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";
import { parseBoolean, parseCsv, parseNumber } from "./common/config/env.js";
import { rateLimitKey } from "./common/security/rate-limit.js";

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    bodyLimit: parseNumber(process.env.MAX_BODY_SIZE, 60 * 1024 * 1024),
    trustProxy: parseBoolean(process.env.TRUST_PROXY, false),
    genReqId: (request: IncomingMessage) => {
      const requestId = request.headers["x-request-id"];
      return typeof requestId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(requestId)
        ? requestId
        : randomUUID();
    },
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: ["req.headers.authorization", "req.headers.cookie", "password", "token"],
    },
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });
  app.useWebSocketAdapter(new WsAdapter(app));
  const fastify = app.getHttpAdapter().getInstance();
  const origins = parseCsv(process.env.CORS_ORIGINS);
  const redis = app.get(RedisService);
  const registerPlugin = fastify.register.bind(fastify) as unknown as (
    plugin: unknown,
    options?: Record<string, unknown>,
  ) => unknown;

  await registerPlugin(helmet);
  await registerPlugin(compress);
  await registerPlugin(multipart, {
    limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 4 },
  });
  await registerPlugin(cors, {
    credentials: true,
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || origins.includes("*") || origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS origin denied"), false);
      }
    },
  });
  const rateLimitOptions: Record<string, unknown> = {
    max: parseNumber(process.env.RATE_LIMIT_MAX, 100),
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? "1 minute",
    keyGenerator: (request: FastifyRequest) => rateLimitKey(request, process.env.JWT_ACCESS_SECRET),
  };
  const redisClient = redis.getClient();
  if (redisClient && await redis.connect()) {
    rateLimitOptions.redis = redisClient;
  } else if (process.env.NODE_ENV === "production" && redis.isConfigured()) {
    throw new Error("Redis is required in production for shared rate limiting");
  }
  await registerPlugin(rateLimit, rateLimitOptions);
  app.setGlobalPrefix(process.env.API_PREFIX ?? "v1", {
    exclude: ["health/live", "health/ready"],
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
  }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  if (parseBoolean(process.env.SWAGGER_ENABLED, process.env.NODE_ENV !== "production")) {
    const config = new DocumentBuilder()
      .setTitle("Brand Deals API")
      .setDescription("Brand and creator marketplace API")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(parseNumber(process.env.PORT, 3000), process.env.HOST ?? "0.0.0.0");
}

void bootstrap();
