import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ScheduledMessageDto,
  ScheduledMessageListResponseDto,
  CreateScheduledMessageDto,
} from './dto';

@Injectable()
export class ScheduledMessagesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    groupId?: string,
    sent?: boolean,
  ): Promise<ScheduledMessageListResponseDto> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (groupId) {
      where.groupId = groupId;
    }

    if (sent !== undefined) {
      where.sent = sent;
    }

    const [messages, total] = await Promise.all([
      this.prisma.scheduledMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sendAt: 'asc' },
        include: {
          group: { select: { title: true } },
        },
      }),
      this.prisma.scheduledMessage.count({ where }),
    ]);

    return {
      data: messages.map((m) => this.mapToDto(m)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(dto: CreateScheduledMessageDto): Promise<ScheduledMessageDto> {
    const sendAt = new Date(dto.sendAt);

    if (sendAt <= new Date()) {
      throw new BadRequestException('sendAt must be in the future');
    }

    const group = await this.prisma.managedGroup.findUnique({
      where: { id: dto.groupId },
      select: { chatId: true, title: true },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${dto.groupId} not found`);
    }

    const createdBy = dto.createdBy ? BigInt(dto.createdBy) : BigInt(0);

    const message = await this.prisma.scheduledMessage.create({
      data: {
        groupId: dto.groupId,
        chatId: group.chatId,
        text: dto.text,
        createdBy,
        sendAt,
      },
      include: {
        group: { select: { title: true } },
      },
    });

    return this.mapToDto(message);
  }

  async remove(id: string): Promise<void> {
    const message = await this.prisma.scheduledMessage.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException(`Scheduled message with ID ${id} not found`);
    }

    if (message.sent) {
      throw new BadRequestException('Cannot delete a message that has already been sent');
    }

    await this.prisma.scheduledMessage.delete({
      where: { id },
    });
  }

  private mapToDto(message: any): ScheduledMessageDto {
    return {
      id: message.id,
      groupId: message.groupId,
      groupTitle: message.group?.title ?? undefined,
      chatId: message.chatId.toString(),
      text: message.text,
      createdBy: message.createdBy.toString(),
      sendAt: message.sendAt,
      sent: message.sent,
      sentAt: message.sentAt ?? undefined,
      createdAt: message.createdAt,
    };
  }
}
