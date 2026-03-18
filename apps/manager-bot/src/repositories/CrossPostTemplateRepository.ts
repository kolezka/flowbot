import type { CrossPostTemplate, PrismaClient } from '@flowbot/db'

export class CrossPostTemplateRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    name: string
    messageText: string
    targetChatIds: bigint[]
    createdBy: bigint
  }): Promise<CrossPostTemplate> {
    return this.prisma.crossPostTemplate.create({ data })
  }

  async findByName(name: string): Promise<CrossPostTemplate | null> {
    return this.prisma.crossPostTemplate.findUnique({ where: { name } })
  }

  async findAllActive(): Promise<CrossPostTemplate[]> {
    return this.prisma.crossPostTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async deleteByName(name: string): Promise<CrossPostTemplate | null> {
    const template = await this.prisma.crossPostTemplate.findUnique({ where: { name } })
    if (!template)
      return null
    return this.prisma.crossPostTemplate.delete({ where: { name } })
  }
}
