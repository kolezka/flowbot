import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConnectionDto,
  ConnectionListResponseDto,
  ConnectionLogDto,
  ConnectionHealthDto,
  CreateConnectionDto,
} from './dto';

@Injectable()
export class ConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    page = 1,
    limit = 20,
    platform?: string,
    status?: string,
  ): Promise<ConnectionListResponseDto> {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (platform) where['platform'] = platform;
    if (status) where['status'] = status;

    const [connections, total] = await Promise.all([
      this.prisma.platformConnection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.platformConnection.count({ where }),
    ]);

    return {
      data: connections.map((c) => this.mapToDto(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<ConnectionDto> {
    const connection = await this.prisma.platformConnection.findUnique({
      where: { id },
    });
    if (!connection) {
      throw new NotFoundException(`Connection ${id} not found`);
    }
    return this.mapToDto(connection);
  }

  async create(dto: CreateConnectionDto): Promise<ConnectionDto> {
    const connection = await this.prisma.platformConnection.create({
      data: {
        platform: dto.platform,
        name: dto.name,
        connectionType: dto.connectionType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: (dto.metadata ?? null) as any,
        botInstanceId: dto.botInstanceId ?? null,
        status: 'inactive',
      },
    });
    return this.mapToDto(connection);
  }

  async updateStatus(
    id: string,
    status: string,
    errorMessage?: string,
  ): Promise<ConnectionDto> {
    await this.findOne(id);

    const data: Record<string, unknown> = { status };
    if (errorMessage !== undefined) {
      data['lastErrorMessage'] = errorMessage;
    }
    if (status === 'error' && errorMessage !== undefined) {
      data['errorCount'] = { increment: 1 };
    }

    const updated = await this.prisma.platformConnection.update({
      where: { id },
      data,
    });
    return this.mapToDto(updated);
  }

  async startAuth(
    id: string,
    params: Record<string, unknown>,
  ): Promise<ConnectionDto> {
    await this.findOne(id);

    const existing = await this.prisma.platformConnection.findUnique({
      where: { id },
    });

    const existingMetadata =
      existing && existing.metadata && typeof existing.metadata === 'object'
        ? (existing.metadata as Record<string, unknown>)
        : {};

    const updated = await this.prisma.platformConnection.update({
      where: { id },
      data: {
        status: 'authenticating',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: {
          ...existingMetadata,
          authState: { params, startedAt: new Date().toISOString() },
        } as any,
      },
    });
    return this.mapToDto(updated);
  }

  async submitAuthStep(
    id: string,
    step: string,
    data: unknown,
  ): Promise<ConnectionDto> {
    await this.findOne(id);

    const existing = await this.prisma.platformConnection.findUnique({
      where: { id },
    });

    const existingMetadata =
      existing && existing.metadata && typeof existing.metadata === 'object'
        ? (existing.metadata as Record<string, unknown>)
        : {};

    const existingAuthState =
      existingMetadata['authState'] &&
      typeof existingMetadata['authState'] === 'object'
        ? (existingMetadata['authState'] as Record<string, unknown>)
        : {};

    const newStatus = step === 'complete' ? 'active' : 'authenticating';
    const lastActiveAt = step === 'complete' ? new Date() : undefined;

    const updateData: Record<string, unknown> = {
      status: newStatus,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: {
        ...existingMetadata,
        authState: {
          ...existingAuthState,
          [step]: data,
          lastStep: step,
        },
      } as any,
    };

    if (lastActiveAt !== undefined) {
      updateData['lastActiveAt'] = lastActiveAt;
    }

    const updated = await this.prisma.platformConnection.update({
      where: { id },
      data: updateData,
    });
    return this.mapToDto(updated);
  }

  async getLogs(
    connectionId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: ConnectionLogDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    await this.findOne(connectionId);

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.platformConnectionLog.findMany({
        where: { connectionId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.platformConnectionLog.count({ where: { connectionId } }),
    ]);

    return {
      data: logs.map((log) => this.mapLogToDto(log)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getHealth(): Promise<ConnectionHealthDto> {
    const connections = await this.prisma.platformConnection.findMany({
      select: { platform: true, status: true },
    });

    const totalConnections = connections.length;
    const activeConnections = connections.filter((c) => c.status === 'active').length;
    const errorConnections = connections.filter((c) => c.status === 'error').length;

    const platforms: Record<string, { total: number; active: number; error: number }> = {};
    for (const conn of connections) {
      if (!platforms[conn.platform]) {
        platforms[conn.platform] = { total: 0, active: 0, error: 0 };
      }
      platforms[conn.platform].total++;
      if (conn.status === 'active') platforms[conn.platform].active++;
      if (conn.status === 'error') platforms[conn.platform].error++;
    }

    return { totalConnections, activeConnections, errorConnections, platforms };
  }

  async deactivate(id: string): Promise<ConnectionDto> {
    await this.findOne(id);
    const updated = await this.prisma.platformConnection.update({
      where: { id },
      data: { status: 'inactive' },
    });
    return this.mapToDto(updated);
  }

  private mapToDto(connection: Record<string, unknown>): ConnectionDto {
    return {
      id: connection['id'] as string,
      platform: connection['platform'] as string,
      name: connection['name'] as string,
      connectionType: connection['connectionType'] as string,
      status: connection['status'] as string,
      metadata:
        connection['metadata'] != null
          ? (connection['metadata'] as Record<string, unknown>)
          : undefined,
      errorCount: connection['errorCount'] as number,
      lastErrorMessage:
        connection['lastErrorMessage'] != null
          ? (connection['lastErrorMessage'] as string)
          : undefined,
      lastActiveAt:
        connection['lastActiveAt'] != null
          ? (connection['lastActiveAt'] as Date)
          : undefined,
      botInstanceId:
        connection['botInstanceId'] != null
          ? (connection['botInstanceId'] as string)
          : undefined,
      createdAt: connection['createdAt'] as Date,
      updatedAt: connection['updatedAt'] as Date,
    };
  }

  private mapLogToDto(log: Record<string, unknown>): ConnectionLogDto {
    return {
      id: log['id'] as string,
      connectionId: log['connectionId'] as string,
      level: log['level'] as string,
      message: log['message'] as string,
      details:
        log['details'] != null
          ? (log['details'] as Record<string, unknown>)
          : undefined,
      createdAt: log['createdAt'] as Date,
    };
  }
}
