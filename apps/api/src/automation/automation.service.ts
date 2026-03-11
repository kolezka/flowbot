import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AutomationJobDto,
  AutomationJobListResponseDto,
  AutomationStatsDto,
  ClientLogDto,
  ClientLogListResponseDto,
} from './dto';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private prisma: PrismaService) {}

  async getHealth(): Promise<any> {
    const [tgClientHealth, jobMetrics1h, jobMetrics24h, session] = await Promise.all([
      this.fetchTgClientHealth(),
      this.getJobMetricsSince(1),
      this.getJobMetricsSince(24),
      this.getLatestSession(),
    ]);

    const status = tgClientHealth.reachable
      ? (tgClientHealth.status === 'ok' ? 'healthy' : 'degraded')
      : 'unreachable';

    return {
      status,
      tgClient: tgClientHealth,
      jobMetrics: {
        last1h: jobMetrics1h,
        last24h: jobMetrics24h,
        successRate1h: jobMetrics1h.total > 0 ? Math.round((jobMetrics1h.completed / jobMetrics1h.total) * 100) : 0,
        successRate24h: jobMetrics24h.total > 0 ? Math.round((jobMetrics24h.completed / jobMetrics24h.total) * 100) : 0,
      },
      session: session ? {
        exists: true,
        updatedAt: session.updatedAt,
        isActive: session.isActive,
        lastUsedAt: session.lastUsedAt,
      } : { exists: false },
      lastChecked: new Date(),
    };
  }

  async getJobs(
    page: number = 1,
    limit: number = 20,
    status?: string,
  ): Promise<AutomationJobListResponseDto> {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [jobs, total] = await Promise.all([
      this.prisma.broadcastMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.broadcastMessage.count({ where }),
    ]);

    return {
      data: jobs.map(this.mapJobToDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getJob(id: string): Promise<AutomationJobDto> {
    const job = await this.prisma.broadcastMessage.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return this.mapJobToDto(job);
  }

  async getStats(): Promise<AutomationStatsDto> {
    const [total, pending, completed, failed] = await Promise.all([
      this.prisma.broadcastMessage.count(),
      this.prisma.broadcastMessage.count({ where: { status: 'pending' } }),
      this.prisma.broadcastMessage.count({ where: { status: 'completed' } }),
      this.prisma.broadcastMessage.count({ where: { status: 'failed' } }),
    ]);

    return { total, pending, completed, failed };
  }

  async getLogs(
    page: number = 1,
    limit: number = 20,
    level?: string,
  ): Promise<ClientLogListResponseDto> {
    const skip = (page - 1) * limit;
    const where = level ? { level } : {};

    const [logs, total] = await Promise.all([
      this.prisma.clientLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.clientLog.count({ where }),
    ]);

    return {
      data: logs.map(this.mapLogToDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async fetchTgClientHealth(): Promise<any> {
    const url = process.env.TG_CLIENT_HEALTH_URL || 'http://localhost:3002/health';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      const data = await response.json() as Record<string, unknown>;
      return { reachable: true, ...data };
    } catch (error) {
      this.logger.warn('TG client health check failed', error);
      return { reachable: false, status: 'unreachable' };
    }
  }

  private async getJobMetricsSince(hours: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const [completed, failed, total] = await Promise.all([
      this.prisma.broadcastMessage.count({ where: { status: 'completed', createdAt: { gte: since } } }),
      this.prisma.broadcastMessage.count({ where: { status: 'failed', createdAt: { gte: since } } }),
      this.prisma.broadcastMessage.count({ where: { createdAt: { gte: since } } }),
    ]);
    return { completed, failed, total };
  }

  private async getLatestSession() {
    try {
      return await this.prisma.clientSession.findFirst({ orderBy: { updatedAt: 'desc' } });
    } catch {
      return null;
    }
  }

  private mapJobToDto(job: any): AutomationJobDto {
    return {
      id: job.id,
      status: job.status,
      text: job.text,
      targetChatIds: job.targetChatIds.map((id: bigint) => id.toString()),
      results: job.results,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private mapLogToDto(log: any): ClientLogDto {
    return {
      id: log.id,
      level: log.level,
      message: log.message,
      details: log.details,
      createdAt: log.createdAt,
    };
  }

}
