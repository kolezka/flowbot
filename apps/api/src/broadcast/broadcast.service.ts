import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { tasks } from '@trigger.dev/sdk/v3';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import {
  BroadcastDto,
  BroadcastListResponseDto,
  CreateBroadcastDto,
  UpdateBroadcastDto,
} from './dto';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
  ): Promise<BroadcastListResponseDto> {
    const skip = (page - 1) * limit;

    const [broadcasts, total] = await Promise.all([
      this.prisma.broadcastMessage.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.broadcastMessage.count(),
    ]);

    return {
      data: broadcasts.map(this.mapToDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<BroadcastDto> {
    const broadcast = await this.prisma.broadcastMessage.findUnique({
      where: { id },
    });

    if (!broadcast) {
      throw new NotFoundException(`Broadcast with ID ${id} not found`);
    }

    return this.mapToDto(broadcast);
  }

  async create(createBroadcastDto: CreateBroadcastDto): Promise<BroadcastDto> {
    const broadcast = await this.prisma.broadcastMessage.create({
      data: {
        text: createBroadcastDto.text,
        targetChatIds: createBroadcastDto.targetChatIds.map(id => BigInt(id)),
        status: 'pending',
      },
    });

    this.logger.log(`Broadcast created: ${broadcast.id}`);

    this.eventBus.emitAutomation({
      type: 'broadcast.created',
      jobId: broadcast.id,
      data: { text: broadcast.text },
      timestamp: new Date(),
    });

    try {
      await tasks.trigger('broadcast', { broadcastId: broadcast.id });
      this.logger.log(`Broadcast task triggered: ${broadcast.id}`);
    } catch (error) {
      this.logger.warn(`Failed to trigger broadcast task: ${error}`);
    }

    return this.mapToDto(broadcast);
  }

  async update(id: string, dto: UpdateBroadcastDto): Promise<BroadcastDto> {
    const broadcast = await this.prisma.broadcastMessage.findUnique({
      where: { id },
    });
    if (!broadcast) {
      throw new NotFoundException(`Broadcast ${id} not found`);
    }
    if (broadcast.status !== 'pending') {
      throw new BadRequestException('Only pending broadcasts can be edited');
    }

    const updateData: any = {};
    if (dto.text !== undefined) updateData.text = dto.text;
    if (dto.targetChatIds !== undefined) {
      updateData.targetChatIds = dto.targetChatIds.map((cid) => BigInt(cid));
    }

    const updated = await this.prisma.broadcastMessage.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Broadcast updated: ${id}`);
    return this.mapToDto(updated);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const broadcast = await this.prisma.broadcastMessage.findUnique({
      where: { id },
    });
    if (!broadcast) {
      throw new NotFoundException(`Broadcast ${id} not found`);
    }

    await this.prisma.broadcastMessage.delete({ where: { id } });
    this.logger.log(`Broadcast deleted: ${id}`);
    return { deleted: true };
  }

  async retry(id: string): Promise<BroadcastDto> {
    const broadcast = await this.prisma.broadcastMessage.findUnique({
      where: { id },
    });
    if (!broadcast) {
      throw new NotFoundException(`Broadcast ${id} not found`);
    }
    if (broadcast.status !== 'failed') {
      throw new BadRequestException('Only failed broadcasts can be retried');
    }

    const newBroadcast = await this.prisma.broadcastMessage.create({
      data: {
        text: broadcast.text,
        targetChatIds: broadcast.targetChatIds,
        status: 'pending',
      },
    });

    this.logger.log(`Broadcast retried: ${id} -> ${newBroadcast.id}`);

    this.eventBus.emitAutomation({
      type: 'broadcast.created',
      jobId: newBroadcast.id,
      data: { text: newBroadcast.text, retriedFrom: id },
      timestamp: new Date(),
    });

    try {
      await tasks.trigger('broadcast', { broadcastId: newBroadcast.id });
      this.logger.log(`Broadcast retry task triggered: ${newBroadcast.id}`);
    } catch (error) {
      this.logger.warn(`Failed to trigger broadcast retry task: ${error}`);
    }

    return this.mapToDto(newBroadcast);
  }

  private mapToDto(broadcast: any): BroadcastDto {
    return {
      id: broadcast.id,
      status: broadcast.status,
      text: broadcast.text,
      targetChatIds: broadcast.targetChatIds.map((id: bigint) => id.toString()),
      results: broadcast.results,
      createdAt: broadcast.createdAt,
      updatedAt: broadcast.updatedAt,
    };
  }
}
