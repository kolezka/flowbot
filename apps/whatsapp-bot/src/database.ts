import { PrismaClient } from '@flowbot/db'

let prisma: PrismaClient | null = null

export function createDatabase(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient()
  }
  return prisma
}
