import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private readonly startTime = Date.now();

  constructor(private prisma: PrismaService) {}

  async getStatus() {
    const [dbStatus, connectorPoolStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkService(
        process.env.CONNECTOR_POOL_HEALTH_URL || 'http://localhost:3010/health',
        'Connector Pool',
      ),
    ]);

    const apiStatus = {
      name: 'API',
      status: 'up' as const,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      lastChecked: new Date(),
    };

    const components: Array<{
      name: string;
      status: string;
      lastChecked: Date;
      uptime?: number;
      error?: string;
      details?: Record<string, unknown>;
    }> = [apiStatus, dbStatus, connectorPoolStatus];
    const worstStatus = components.some((c) => c.status === 'down')
      ? 'down'
      : components.some(
            (c) => c.status === 'degraded' || c.status === 'unreachable',
          )
        ? 'degraded'
        : 'up';

    return {
      overall: worstStatus,
      components,
      lastChecked: new Date(),
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'Database',
        status: 'up' as const,
        lastChecked: new Date(),
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        name: 'Database',
        status: 'down' as const,
        lastChecked: new Date(),
        error: 'Connection failed',
      };
    }
  }

  async getWorkers() {
    const baseUrl = (
      process.env.CONNECTOR_POOL_HEALTH_URL || 'http://localhost:3010/health'
    ).replace(/\/health$/, '');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${baseUrl}/instances`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = (await response.json()) as {
        instances: Array<{
          instanceId: string;
          pool: string;
          status: string;
          health: {
            connected: boolean;
            uptime: number;
            actionCount: number;
            errorCount: number;
          } | null;
        }>;
      };
      return { instances: data.instances };
    } catch {
      return { instances: [] };
    }
  }

  private async checkService(url: string, name: string) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      const data = (await response.json()) as Record<string, unknown>;
      return {
        name,
        status: 'up' as const,
        lastChecked: new Date(),
        details: data,
      };
    } catch {
      return {
        name,
        status: 'unreachable' as const,
        lastChecked: new Date(),
      };
    }
  }
}
