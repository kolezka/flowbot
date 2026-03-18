import { createPrismaClient } from '@flowbot/db'

let prisma: ReturnType<typeof createPrismaClient> | null = null

export function getPrisma() {
  if (!prisma) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required')
    }
    prisma = createPrismaClient(databaseUrl)
  }
  return prisma
}
