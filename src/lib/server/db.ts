import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getServerEnv } from "./env";

/**
 * Prisma client dùng chung (singleton) để tránh mở quá nhiều kết nối khi hot-reload trong dev.
 * Dùng driver adapter `pg` để chạy trên PostgreSQL mà không cần binary native của Prisma.
 */
const globalForPrisma = globalThis as unknown as { __aimforgePrisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (globalForPrisma.__aimforgePrisma) return globalForPrisma.__aimforgePrisma;
  const { databaseUrl } = getServerEnv();
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  if (process.env.NODE_ENV !== "production") globalForPrisma.__aimforgePrisma = client;
  return client;
}
