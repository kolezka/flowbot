import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BroadcastDto, BroadcastListResponseDto, CreateBroadcastDto } from './dto';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(private prisma: PrismaService) {}

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

    return this.mapToDto(broadcast);
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
