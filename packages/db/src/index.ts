import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type PrismaClient as PrismaClientType } from "./generated/prisma/client";
export { PrismaClient } from "./generated/prisma/client";

export function createPrismaClient(DATABASE_URL: string): PrismaClientType {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const adapter = new PrismaPg({
    connectionString: DATABASE_URL,
  });

  return new PrismaClient({
    adapter,
  }) as PrismaClientType;
}

export * from "./generated/prisma/client";
export { resolveIdentity, linkToUser, getFullProfile } from "./services/identity";
export * from "./flow-types";