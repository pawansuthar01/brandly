import { BadRequestException } from "@nestjs/common";

const productionSecretMinimumLength = 32;

export function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return fallback;
}

export function parseNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseCsv(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const nodeEnv = config.NODE_ENV ?? "development";
  if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
    throw new BadRequestException("NODE_ENV must be development, test, or production");
  }

  if (nodeEnv === "production") {
    for (const name of ["DATABASE_URL", "REDIS_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
      const value = config[name];
      if (typeof value !== "string" || value.length < productionSecretMinimumLength) {
        throw new BadRequestException(`${name} is required in production`);
      }
    }
  }

  return config;
}
