import type { PrismaClient } from '@flowbot/db'

export class WarningRepository {
  constructor(private prisma: PrismaClient) {}

  async createWarning(groupId: string, memberId: string, issuerId: bigint, reason?: string, expiresAt?: Date) {
    return this.prisma.warning.create({
      data: { groupId, memberId, issuerId, reason, expiresAt },
    })
  }

  async deactivateLatest(groupId: string, memberId: string) {
    const latest = await this.prisma.warning.findFirst({
      where: { groupId, memberId, isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!latest)
      return null

    return this.prisma.warning.update({
      where: { id: latest.id },
      data: { isActive: false },
    })
  }

  async countActive(groupId: string, memberId: string): Promise<number> {
    return this.prisma.warning.count({
      where: {
        groupId,
        memberId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    })
  }

  async findByMember(groupId: string, memberId: string, limit = 10) {
    return this.prisma.warning.findMany({
      where: { groupId, memberId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
