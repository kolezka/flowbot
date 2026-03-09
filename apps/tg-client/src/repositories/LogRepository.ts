import type { ClientLog, Prisma, PrismaClient } from '@tg-allegro/db'

export class LogRepository {
  constructor(private prisma: PrismaClient) {}

  async createLog(level: string, message: string, details?: Prisma.InputJsonValue): Promise<ClientLog> {
    return this.prisma.clientLog.create({
      data: {
        level,
        message,
        details: details ?? undefined,
      },
    })
  }
}
