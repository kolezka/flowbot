import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CrossPostTemplateDto,
  CrossPostTemplateListResponseDto,
  CreateCrossPostTemplateDto,
  UpdateCrossPostTemplateDto,
} from './dto';

@Injectable()
export class CrossPostService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    isActive?: boolean,
  ): Promise<CrossPostTemplateListResponseDto> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [templates, total] = await Promise.all([
      this.prisma.crossPostTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.crossPostTemplate.count({ where }),
    ]);

    // Collect all unique chatIds across all templates
    const allChatIds = [
      ...new Set(templates.flatMap((t) => t.targetChatIds)),
    ];

    // Resolve group names
    const groups = await this.prisma.managedGroup.findMany({
      where: { chatId: { in: allChatIds } },
      select: { chatId: true, title: true },
    });

    const chatIdToTitle = new Map<string, string>(
      groups.map((g) => [g.chatId.toString(), g.title]),
    );

    return {
      data: templates.map((t) => this.mapToDto(t, chatIdToTitle)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<CrossPostTemplateDto> {
    const template = await this.prisma.crossPostTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`CrossPost template with ID ${id} not found`);
    }

    // Resolve group names
    const groups = await this.prisma.managedGroup.findMany({
      where: { chatId: { in: template.targetChatIds } },
      select: { chatId: true, title: true },
    });

    const chatIdToTitle = new Map<string, string>(
      groups.map((g) => [g.chatId.toString(), g.title]),
    );

    return this.mapToDto(template, chatIdToTitle);
  }

  async create(dto: CreateCrossPostTemplateDto): Promise<CrossPostTemplateDto> {
    const template = await this.prisma.crossPostTemplate.create({
      data: {
        name: dto.name,
        messageText: dto.messageText,
        targetChatIds: dto.targetChatIds.map((id) => BigInt(id)),
        isActive: dto.isActive ?? true,
        createdBy: BigInt(0),
      },
    });

    // Resolve group names
    const groups = await this.prisma.managedGroup.findMany({
      where: { chatId: { in: template.targetChatIds } },
      select: { chatId: true, title: true },
    });

    const chatIdToTitle = new Map<string, string>(
      groups.map((g) => [g.chatId.toString(), g.title]),
    );

    return this.mapToDto(template, chatIdToTitle);
  }

  async update(
    id: string,
    dto: UpdateCrossPostTemplateDto,
  ): Promise<CrossPostTemplateDto> {
    const existing = await this.prisma.crossPostTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`CrossPost template with ID ${id} not found`);
    }

    const data: any = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.messageText !== undefined) {
      data.messageText = dto.messageText;
    }

    if (dto.targetChatIds !== undefined) {
      data.targetChatIds = dto.targetChatIds.map((id) => BigInt(id));
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    const template = await this.prisma.crossPostTemplate.update({
      where: { id },
      data,
    });

    // Resolve group names
    const groups = await this.prisma.managedGroup.findMany({
      where: { chatId: { in: template.targetChatIds } },
      select: { chatId: true, title: true },
    });

    const chatIdToTitle = new Map<string, string>(
      groups.map((g) => [g.chatId.toString(), g.title]),
    );

    return this.mapToDto(template, chatIdToTitle);
  }

  async remove(id: string): Promise<void> {
    const template = await this.prisma.crossPostTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`CrossPost template with ID ${id} not found`);
    }

    await this.prisma.crossPostTemplate.delete({
      where: { id },
    });
  }

  private mapToDto(
    template: any,
    chatIdToTitle: Map<string, string>,
  ): CrossPostTemplateDto {
    const targetChatIds = template.targetChatIds.map((id: bigint) =>
      id.toString(),
    );

    return {
      id: template.id,
      name: template.name,
      messageText: template.messageText,
      targetChatIds,
      targetGroupNames: targetChatIds.map(
        (id: string) => chatIdToTitle.get(id) ?? id,
      ),
      isActive: template.isActive,
      createdBy: template.createdBy.toString(),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
