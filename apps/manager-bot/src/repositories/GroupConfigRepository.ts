import type { GroupConfig, PrismaClient } from '@tg-allegro/db'

export class GroupConfigRepository {
  constructor(private prisma: PrismaClient) {}

  async findOrCreate(groupId: string): Promise<GroupConfig> {
    const existing = await this.prisma.groupConfig.findUnique({
      where: { groupId },
    })
    if (existing)
      return existing

    return this.prisma.groupConfig.create({
      data: { groupId },
    })
  }

  async updateConfig(groupId: string, data: Partial<Omit<GroupConfig, 'id' | 'groupId' | 'createdAt' | 'updatedAt'>>) {
    return this.prisma.groupConfig.update({
      where: { groupId },
      data,
    })
  }
}
