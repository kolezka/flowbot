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

  async getVersion(flowId: string, versionId: string) {
    await this.findOne(flowId);
    const version = await this.prisma.flowVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || version.flowId !== flowId) {
      throw new NotFoundException(`Version ${versionId} not found for flow ${flowId}`);
    }
    return version;
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

  // Global flow analytics (across all flows)
  async getGlobalAnalytics(days: number = 30) {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const [
      totalExecutions,
      completedCount,
      failedCount,
      activeFlowsCount,
      totalFlowsCount,
      recentExecutions,
      topFlowsRaw,
    ] = await Promise.all([
      this.prisma.flowExecution.count({ where: { startedAt: { gte: sinceDate } } }),
      this.prisma.flowExecution.count({ where: { startedAt: { gte: sinceDate }, status: 'completed' } }),
      this.prisma.flowExecution.count({ where: { startedAt: { gte: sinceDate }, status: 'failed' } }),
      this.prisma.flowDefinition.count({ where: { status: 'active' } }),
      this.prisma.flowDefinition.count(),
      this.prisma.flowExecution.findMany({
        where: { startedAt: { gte: sinceDate } },
        select: { startedAt: true, completedAt: true, status: true, error: true, flowId: true },
        orderBy: { startedAt: 'desc' },
        take: 2000,
      }),
      this.prisma.flowExecution.groupBy({
        by: ['flowId'],
        where: { startedAt: { gte: sinceDate } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    // Build daily stats
    const dailyMap: Record<string, { total: number; completed: number; failed: number }> = {};
    let totalDurationMs = 0;
    let durationCount = 0;
    const errorCounts: Record<string, number> = {};

    for (const exec of recentExecutions) {
      const dayKey = exec.startedAt.toISOString().slice(0, 10);
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { total: 0, completed: 0, failed: 0 };
      }
      dailyMap[dayKey]!.total++;
      if (exec.status === 'completed') dailyMap[dayKey]!.completed++;
      if (exec.status === 'failed') dailyMap[dayKey]!.failed++;

      if (exec.completedAt) {
        totalDurationMs += new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime();
        durationCount++;
      }
      if (exec.status === 'failed' && exec.error) {
        const errorKey = exec.error.slice(0, 100);
        errorCounts[errorKey] = (errorCounts[errorKey] ?? 0) + 1;
      }
    }

    // Fill in missing days
    const dailyStats: Array<{ date: string; total: number; completed: number; failed: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyStats.push({
        date: key,
        total: dailyMap[key]?.total ?? 0,
        completed: dailyMap[key]?.completed ?? 0,
        failed: dailyMap[key]?.failed ?? 0,
      });
    }

    const avgDurationMs = durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0;
    const successRate = totalExecutions > 0 ? Math.round((completedCount / totalExecutions) * 10000) / 100 : 0;

    // Enrich top flows with names
    const flowIds = topFlowsRaw.map((f) => f.flowId);
    const flowDefs = flowIds.length > 0
      ? await this.prisma.flowDefinition.findMany({
          where: { id: { in: flowIds } },
          select: { id: true, name: true, status: true },
        })
      : [];
    const flowMap = new Map(flowDefs.map((f) => [f.id, f]));

    // Calculate per-flow success rates
    const flowSuccessCounts: Record<string, number> = {};
    const flowTotalCounts: Record<string, number> = {};
    for (const exec of recentExecutions) {
      if (flowIds.includes(exec.flowId)) {
        flowTotalCounts[exec.flowId] = (flowTotalCounts[exec.flowId] ?? 0) + 1;
        if (exec.status === 'completed') {
          flowSuccessCounts[exec.flowId] = (flowSuccessCounts[exec.flowId] ?? 0) + 1;
        }
      }
    }

    const topFlows = topFlowsRaw.map((f) => {
      const def = flowMap.get(f.flowId);
      const total = flowTotalCounts[f.flowId] ?? 0;
      const succeeded = flowSuccessCounts[f.flowId] ?? 0;
      return {
        flowId: f.flowId,
        name: def?.name ?? 'Unknown',
        status: def?.status ?? 'unknown',
        executions: f._count.id,
        successRate: total > 0 ? Math.round((succeeded / total) * 10000) / 100 : 0,
      };
    });

    const commonErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));

    return {
      totalExecutions,
      completedCount,
      failedCount,
      runningCount: totalExecutions - completedCount - failedCount,
      activeFlowsCount,
      totalFlowsCount,
      avgDurationMs,
      successRate,
      dailyStats,
      topFlows,
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

  async getExecution(executionId: string) {
    const execution = await this.prisma.flowExecution.findUnique({
      where: { id: executionId },
    });
    if (!execution) throw new NotFoundException(`Execution ${executionId} not found`);
    return execution;
  }

  async testExecute(flowId: string, triggerData?: any) {
    const flow = await this.findOne(flowId);
    const nodes = (flow.nodesJson as any[]) || [];
    const edges = (flow.edgesJson as any[]) || [];

    // Create execution record
    const execution = await this.prisma.flowExecution.create({
      data: {
        flowId,
        status: 'running',
        triggerData: triggerData ?? {},
        nodeResults: {},
      },
    });

    // Simulate execution in background (non-blocking)
    this.simulateExecution(execution.id, nodes, edges).catch((err) => {
      this.logger.error(`Test execution ${execution.id} failed: ${err.message}`);
    });

    return execution;
  }

  private async simulateExecution(executionId: string, nodes: any[], edges: any[]) {
    const nodeResults: Record<string, { status: string; output?: any; startedAt: string; completedAt?: string; error?: string }> = {};

    // Build adjacency for traversal
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source)!.push(edge.target);
    }

    // Find entry nodes (no incoming edges)
    const targetIds = new Set(edges.map((e: any) => e.target));
    const entryNodes = nodes.filter((n: any) => !targetIds.has(n.id));
    if (entryNodes.length === 0 && nodes.length > 0) {
      entryNodes.push(nodes[0]);
    }

    // BFS execution simulation
    const queue = entryNodes.map((n: any) => n.id);
    const visited = new Set<string>();

    try {
      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const node = nodes.find((n: any) => n.id === nodeId);
        if (!node) continue;

        // Mark node as running
        nodeResults[nodeId] = { status: 'running', startedAt: new Date().toISOString() };
        await this.prisma.flowExecution.update({
          where: { id: executionId },
          data: { nodeResults: nodeResults as any },
        });

        // Simulate processing delay (200-800ms per node)
        const delay = 200 + Math.floor(Math.random() * 600);
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Mark node as completed with simulated output
        nodeResults[nodeId] = {
          status: 'completed',
          startedAt: nodeResults[nodeId].startedAt,
          completedAt: new Date().toISOString(),
          output: this.getSimulatedOutput(node),
        };
        await this.prisma.flowExecution.update({
          where: { id: executionId },
          data: { nodeResults: nodeResults as any },
        });

        // Queue next nodes
        for (const nextId of adjacency.get(nodeId) ?? []) {
          if (!visited.has(nextId)) queue.push(nextId);
        }
      }

      // Mark execution as completed
      await this.prisma.flowExecution.update({
        where: { id: executionId },
        data: { status: 'completed', completedAt: new Date(), nodeResults: nodeResults as any },
      });
    } catch (error: any) {
      await this.prisma.flowExecution.update({
        where: { id: executionId },
        data: { status: 'failed', completedAt: new Date(), error: error.message, nodeResults: nodeResults as any },
      });
    }
  }

  private getSimulatedOutput(node: any): any {
    const type = node.data?.nodeType ?? node.type;
    switch (type) {
      case 'message_received': return { text: 'Hello bot!', from: { id: 12345, name: 'Test User' } };
      case 'user_joins': return { userId: 12345, username: 'testuser' };
      case 'schedule': return { triggeredAt: new Date().toISOString() };
      case 'webhook': return { payload: { key: 'value' } };
      case 'keyword_match': return { matched: true, keyword: 'test' };
      case 'user_role': return { role: 'member', allowed: true };
      case 'time_based': return { inRange: true };
      case 'send_message': return { messageId: 999, sent: true };
      case 'forward_message': return { forwarded: true };
      case 'ban_user': return { banned: true, userId: 12345 };
      case 'mute_user': return { muted: true, userId: 12345 };
      case 'api_call': return { statusCode: 200, body: { ok: true } };
      case 'delay': return { waited: '1s' };
      case 'db_query': return { rows: 3 };
      case 'transform': return { transformed: true };
      default: return { executed: true };
    }
  }
}
