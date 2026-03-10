import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFlowDto, UpdateFlowDto } from './dto';

@Injectable()
export class FlowsService {
  private readonly logger = new Logger(FlowsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [flows, total] = await Promise.all([
      this.prisma.flowDefinition.findMany({
        where, skip, take: limit,
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { executions: true } } },
      }),
      this.prisma.flowDefinition.count({ where }),
    ]);

    return {
      data: flows,
      total, page, limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const flow = await this.prisma.flowDefinition.findUnique({
      where: { id },
      include: { _count: { select: { executions: true } } },
    });
    if (!flow) throw new NotFoundException(`Flow ${id} not found`);
    return flow;
  }

  async create(dto: CreateFlowDto) {
    return this.prisma.flowDefinition.create({
      data: { name: dto.name, description: dto.description },
    });
  }

  async update(id: string, dto: UpdateFlowDto) {
    await this.findOne(id);
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.nodesJson !== undefined) data.nodesJson = dto.nodesJson;
    if (dto.edgesJson !== undefined) data.edgesJson = dto.edgesJson;

    return this.prisma.flowDefinition.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.flowDefinition.delete({ where: { id } });
    return { deleted: true };
  }

  async validate(id: string) {
    const flow = await this.findOne(id);
    const nodes = flow.nodesJson as any[];
    const edges = flow.edgesJson as any[];
    const errors: string[] = [];

    if (!Array.isArray(nodes) || nodes.length === 0) {
      errors.push('Flow must have at least one node');
    }

    // Check for trigger node
    const triggers = nodes.filter((n: any) => n.category === 'trigger');
    if (triggers.length === 0) {
      errors.push('Flow must have at least one trigger node');
    }

    // Check for cycles (basic DFS)
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source)!.push(edge.target);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();

    function hasCycle(node: string): boolean {
      if (inStack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      inStack.add(node);
      for (const neighbor of adjacency.get(node) ?? []) {
        if (hasCycle(neighbor)) return true;
      }
      inStack.delete(node);
      return false;
    }

    for (const node of nodes) {
      if (hasCycle(node.id)) {
        errors.push('Flow contains a cycle');
        break;
      }
    }

    // Check all edges reference existing nodes
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    for (const edge of edges) {
      if (!nodeIds.has(edge.source)) errors.push(`Edge references non-existent source node: ${edge.source}`);
      if (!nodeIds.has(edge.target)) errors.push(`Edge references non-existent target node: ${edge.target}`);
    }

    return { valid: errors.length === 0, errors };
  }

  async activate(id: string) {
    const validation = await this.validate(id);
    if (!validation.valid) {
      throw new BadRequestException(`Flow validation failed: ${validation.errors.join(', ')}`);
    }

    return this.prisma.flowDefinition.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.flowDefinition.update({
      where: { id },
      data: { status: 'inactive' },
    });
  }

  // Version History
  async getVersions(flowId: string) {
    await this.findOne(flowId); // ensure flow exists
    return this.prisma.flowVersion.findMany({
      where: { flowId },
      orderBy: { version: 'desc' },
    });
  }

  async createVersion(flowId: string, createdBy?: string) {
    const flow = await this.findOne(flowId);
    const latestVersion = await this.prisma.flowVersion.findFirst({
      where: { flowId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

    return this.prisma.flowVersion.create({
      data: {
        flowId,
        version: nextVersion,
        nodesJson: flow.nodesJson,
        edgesJson: flow.edgesJson,
        createdBy,
      },
    });
  }

  async restoreVersion(flowId: string, versionId: string) {
    await this.findOne(flowId);
    const version = await this.prisma.flowVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || version.flowId !== flowId) {
      throw new NotFoundException(`Version ${versionId} not found for flow ${flowId}`);
    }

    return this.prisma.flowDefinition.update({
      where: { id: flowId },
      data: {
        nodesJson: version.nodesJson,
        edgesJson: version.edgesJson,
      },
    });
  }

  // Analytics
  async getAnalytics(flowId: string) {
    await this.findOne(flowId);

    const [total, completed, failed, executions] = await Promise.all([
      this.prisma.flowExecution.count({ where: { flowId } }),
      this.prisma.flowExecution.count({ where: { flowId, status: 'completed' } }),
      this.prisma.flowExecution.count({ where: { flowId, status: 'failed' } }),
      this.prisma.flowExecution.findMany({
        where: { flowId, completedAt: { not: null } },
        select: { startedAt: true, completedAt: true, status: true, error: true },
        orderBy: { startedAt: 'desc' },
        take: 500,
      }),
    ]);

    // Calculate average duration from completed executions
    let totalDurationMs = 0;
    let durationCount = 0;
    const errorCounts: Record<string, number> = {};

    for (const exec of executions) {
      if (exec.completedAt) {
        totalDurationMs += new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime();
        durationCount++;
      }
      if (exec.status === 'failed' && exec.error) {
        const errorKey = exec.error.slice(0, 100);
        errorCounts[errorKey] = (errorCounts[errorKey] ?? 0) + 1;
      }
    }

    const avgDurationMs = durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0;
    const errorRate = total > 0 ? Math.round((failed / total) * 10000) / 100 : 0;

    // Top errors
    const commonErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));

    return {
      totalExecutions: total,
      completedCount: completed,
      failedCount: failed,
      runningCount: total - completed - failed,
      avgDurationMs,
      errorRate,
      commonErrors,
    };
  }

  // Executions
  async getExecutions(flowId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [executions, total] = await Promise.all([
      this.prisma.flowExecution.findMany({
        where: { flowId }, skip, take: limit,
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.flowExecution.count({ where: { flowId } }),
    ]);

    return { data: executions, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
