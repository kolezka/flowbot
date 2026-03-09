import type { PrismaClient } from '@tg-allegro/db'

export class MemberRepository {
  constructor(private prisma: PrismaClient) {}

  async upsertMember(groupId: string, telegramId: bigint, data?: { role?: string }) {
    return this.prisma.groupMember.upsert({
      where: { groupId_telegramId: { groupId, telegramId } },
      create: { groupId, telegramId, role: data?.role ?? 'member' },
      update: { role: data?.role, lastSeenAt: new Date() },
    })
  }

  async findModerators(groupId: string) {
    return this.prisma.groupMember.findMany({
      where: { groupId, role: 'moderator' },
    })
  }

  async setRole(groupId: string, telegramId: bigint, role: string) {
    return this.prisma.groupMember.upsert({
      where: { groupId_telegramId: { groupId, telegramId } },
      create: { groupId, telegramId, role },
      update: { role },
    })
  }

  async findByGroupAndTelegram(groupId: string, telegramId: bigint) {
    return this.prisma.groupMember.findUnique({
      where: { groupId_telegramId: { groupId, telegramId } },
    })
  }

  async incrementMessageCount(groupId: string, telegramId: bigint) {
    return this.prisma.groupMember.upsert({
      where: { groupId_telegramId: { groupId, telegramId } },
      create: { groupId, telegramId, messageCount: 1 },
      update: { messageCount: { increment: 1 }, lastSeenAt: new Date() },
    })
  }
}
