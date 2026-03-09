import type { PrismaClient } from '@tg-allegro/db'

export class GroupRepository {
  constructor(private prisma: PrismaClient) {}

  async upsertGroup(chatId: bigint, title?: string) {
    return this.prisma.managedGroup.upsert({
      where: { chatId },
      create: { chatId, title },
      update: { title, isActive: true, leftAt: null },
    })
  }

  async findByChatId(chatId: bigint) {
    return this.prisma.managedGroup.findUnique({
      where: { chatId },
    })
  }

  async deactivate(chatId: bigint) {
    return this.prisma.managedGroup.update({
      where: { chatId },
      data: { isActive: false, leftAt: new Date() },
    })
  }
}
