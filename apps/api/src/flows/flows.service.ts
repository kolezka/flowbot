import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFlowDto, UpdateFlowDto } from './dto';
import type { FlowTemplate } from './flow-templates';

const USER_ACCOUNT_ACTIONS = new Set([
  'user_get_chat_history',
  'user_search_messages',
  'user_get_all_members',
  'user_get_chat_info',
  'user_get_contacts',
  'user_get_dialogs',
  'user_join_chat',
  'user_leave_chat',
  'user_create_group',
  'user_create_channel',
  'user_invite_users',
  'user_send_message',
  'user_send_media',
  'user_forward_message',
  'user_delete_messages',
  'user_update_profile',
  'user_set_status',
  'user_get_profile_photos',
]);

@Injectable()
export class FlowsService {
  private readonly logger = new Logger(FlowsService.name);
  private triggerRegistryVersion = 0;
  private triggerRegistryCache: any[] | null = null;

  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [flows, total] = await Promise.all([
      this.prisma.flowDefinition.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { executions: true } } },
      }),
      this.prisma.flowDefinition.count({ where }),
    ]);

    return {
      data: flows,
      total,
      page,
      limit,
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
    const data: any = { name: dto.name, description: dto.description };
    if (dto.platform) {
      data.transportConfig = { platform: dto.platform, transport: 'auto' };
    }
    return this.prisma.flowDefinition.create({ data });
  }

  async createFromTemplate(template: FlowTemplate) {
    return this.prisma.flowDefinition.create({
      data: {
        name: template.name,
        description: template.description,
        nodesJson: template.nodes as any,
        edgesJson: template.edges as any,
        transportConfig: { platform: template.platform, transport: 'auto' },
      },
    });
  }

  async update(id: string, dto: UpdateFlowDto) {
    await this.findOne(id);
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.nodesJson !== undefined) data.nodesJson = dto.nodesJson;
    if (dto.edgesJson !== undefined) data.edgesJson = dto.edgesJson;
    if (dto.transportConfig !== undefined)
      data.transportConfig = dto.transportConfig;
    if (dto.platform !== undefined) {
      // Merge platform into existing transportConfig
      const existing = (await this.findOne(id)) as any;
      const existingConfig = existing.transportConfig ?? {};
      data.transportConfig = { ...existingConfig, platform: dto.platform };
    }

    return this.prisma.flowDefinition.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.flowDefinition.delete({ where: { id } });
    return { deleted: true };
  }

  async saveDraft(
    flowId: string,
    data: { nodesJson: unknown; edgesJson: unknown },
  ) {
    return this.prisma.flowDefinition.update({
      where: { id: flowId },
      data: { draftJson: data as any },
    });
  }

  async getDraft(flowId: string) {
    const flow = await this.prisma.flowDefinition.findUnique({
      where: { id: flowId },
      select: { draftJson: true },
    });
    return flow?.draftJson ?? null;
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
      if (!nodeIds.has(edge.source))
        errors.push(`Edge references non-existent source node: ${edge.source}`);
      if (!nodeIds.has(edge.target))
        errors.push(`Edge references non-existent target node: ${edge.target}`);
    }

    // Check for user account nodes without a connection
    const transportConfig = flow.transportConfig as Record<
      string,
      unknown
    > | null;
    const hasFlowConnection = !!transportConfig?.platformConnectionId;

    for (const node of nodes) {
      const nodeType =
        ((node.data as Record<string, unknown>)?.type as string) ?? node.type;
      if (USER_ACCOUNT_ACTIONS.has(nodeType)) {
        const nodeData = node.data as Record<string, unknown> | undefined;
        const hasNodeOverride = !!nodeData?.connectionOverride;

        if (!hasFlowConnection && !hasNodeOverride) {
          errors.push(
            `Node "${(node.data as any)?.label ?? nodeType}" requires a User Account connection. ` +
              `Select one in flow settings or set a per-node override.`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async activate(id: string) {
    const validation = await this.validate(id);
    if (!validation.valid) {
      throw new BadRequestException(
        `Flow validation failed: ${validation.errors.join(', ')}`,
      );
    }

    // Check for circular run_flow references
    const cycle = await this.detectRunFlowCycles(id);
    if (cycle) {
      throw new BadRequestException(
        `Circular flow reference detected: ${cycle.join(' → ')}`,
      );
    }

    const result = await this.prisma.flowDefinition.update({
      where: { id },
      data: { status: 'active' },
    });

    await this.rebuildTriggerRegistry();
    return result;
  }

  async deactivate(id: string) {
    await this.findOne(id);
    const result = await this.prisma.flowDefinition.update({
      where: { id },
      data: { status: 'inactive' },
    });

    await this.rebuildTriggerRegistry();
    return result;
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
      throw new NotFoundException(
        `Version ${versionId} not found for flow ${flowId}`,
      );
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
      throw new NotFoundException(
        `Version ${versionId} not found for flow ${flowId}`,
      );
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
      this.prisma.flowExecution.count({
        where: { flowId, status: 'completed' },
      }),
      this.prisma.flowExecution.count({ where: { flowId, status: 'failed' } }),
      this.prisma.flowExecution.findMany({
        where: { flowId, completedAt: { not: null } },
        select: {
          startedAt: true,
          completedAt: true,
          status: true,
          error: true,
        },
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
        totalDurationMs +=
          new Date(exec.completedAt).getTime() -
          new Date(exec.startedAt).getTime();
        durationCount++;
      }
      if (exec.status === 'failed' && exec.error) {
        const errorKey = exec.error.slice(0, 100);
        errorCounts[errorKey] = (errorCounts[errorKey] ?? 0) + 1;
      }
    }

    const avgDurationMs =
      durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0;
    const errorRate =
      total > 0 ? Math.round((failed / total) * 10000) / 100 : 0;

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
      this.prisma.flowExecution.count({
        where: { startedAt: { gte: sinceDate } },
      }),
      this.prisma.flowExecution.count({
        where: { startedAt: { gte: sinceDate }, status: 'completed' },
      }),
      this.prisma.flowExecution.count({
        where: { startedAt: { gte: sinceDate }, status: 'failed' },
      }),
      this.prisma.flowDefinition.count({ where: { status: 'active' } }),
      this.prisma.flowDefinition.count(),
      this.prisma.flowExecution.findMany({
        where: { startedAt: { gte: sinceDate } },
        select: {
          startedAt: true,
          completedAt: true,
          status: true,
          error: true,
          flowId: true,
        },
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
    const dailyMap: Record<
      string,
      { total: number; completed: number; failed: number }
    > = {};
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
        totalDurationMs +=
          new Date(exec.completedAt).getTime() -
          new Date(exec.startedAt).getTime();
        durationCount++;
      }
      if (exec.status === 'failed' && exec.error) {
        const errorKey = exec.error.slice(0, 100);
        errorCounts[errorKey] = (errorCounts[errorKey] ?? 0) + 1;
      }
    }

    // Fill in missing days
    const dailyStats: Array<{
      date: string;
      total: number;
      completed: number;
      failed: number;
    }> = [];
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

    const avgDurationMs =
      durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0;
    const successRate =
      totalExecutions > 0
        ? Math.round((completedCount / totalExecutions) * 10000) / 100
        : 0;

    // Enrich top flows with names
    const flowIds = topFlowsRaw.map((f) => f.flowId);
    const flowDefs =
      flowIds.length > 0
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
          flowSuccessCounts[exec.flowId] =
            (flowSuccessCounts[exec.flowId] ?? 0) + 1;
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
        successRate:
          total > 0 ? Math.round((succeeded / total) * 10000) / 100 : 0,
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
        where: { flowId },
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.flowExecution.count({ where: { flowId } }),
    ]);

    return {
      data: executions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getExecution(executionId: string) {
    const execution = await this.prisma.flowExecution.findUnique({
      where: { id: executionId },
    });
    if (!execution)
      throw new NotFoundException(`Execution ${executionId} not found`);
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
      this.logger.error(
        `Test execution ${execution.id} failed: ${err.message}`,
      );
    });

    return execution;
  }

  private async simulateExecution(
    executionId: string,
    nodes: any[],
    edges: any[],
  ) {
    const nodeResults: Record<
      string,
      {
        status: string;
        output?: any;
        startedAt: string;
        completedAt?: string;
        error?: string;
      }
    > = {};

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
        nodeResults[nodeId] = {
          status: 'running',
          startedAt: new Date().toISOString(),
        };
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
        data: {
          status: 'completed',
          completedAt: new Date(),
          nodeResults: nodeResults as any,
        },
      });
    } catch (error: any) {
      await this.prisma.flowExecution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: error.message,
          nodeResults: nodeResults as any,
        },
      });
    }
  }

  private getSimulatedOutput(node: any): any {
    const type = node.data?.nodeType ?? node.type;
    switch (type) {
      // Triggers
      case 'message_received':
        return {
          text: 'Hello bot!',
          from: { id: 12345, name: 'Test User' },
          messageType: 'text',
        };
      case 'user_joins':
        return { userId: 12345, username: 'testuser' };
      case 'user_leaves':
        return { userId: 12345, username: 'testuser', wasKicked: false };
      case 'callback_query':
        return {
          callbackQueryId: 'cq_123',
          callbackData: 'action:confirm',
          from: { id: 12345, name: 'Test User' },
        };
      case 'command_received':
        return {
          command: '/start',
          args: 'ref123',
          from: { id: 12345, name: 'Test User' },
        };
      case 'message_edited':
        return {
          messageId: 555,
          text: 'Edited message text',
          from: { id: 12345, name: 'Test User' },
        };
      case 'chat_member_updated':
        return {
          userId: 12345,
          oldStatus: 'member',
          newStatus: 'administrator',
        };
      case 'schedule':
        return { triggeredAt: new Date().toISOString() };
      case 'webhook':
        return { payload: { key: 'value' } };
      // Conditions
      case 'keyword_match':
        return { matched: true, keyword: 'test' };
      case 'user_role':
        return { role: 'member', allowed: true };
      case 'time_based':
        return { inRange: true };
      case 'message_type':
        return { messageType: 'text', matched: true };
      case 'chat_type':
        return { chatType: 'supergroup', matched: true };
      case 'regex_match':
        return { matched: true, pattern: '\\d+', match: '42' };
      case 'has_media':
        return { hasMedia: true, mediaType: 'photo' };
      // Actions
      case 'send_message':
        return { messageId: 999, sent: true };
      case 'send_photo':
        return {
          messageId: 1000,
          sent: true,
          photoUrl: 'https://example.com/photo.jpg',
        };
      case 'forward_message':
        return { forwarded: true, messageId: 1001 };
      case 'copy_message':
        return { messageId: 1002, copied: true };
      case 'edit_message':
        return { messageId: 555, edited: true };
      case 'delete_message':
        return { messageId: 555, deleted: true };
      case 'pin_message':
        return { messageId: 555, pinned: true };
      case 'unpin_message':
        return { unpinned: true };
      case 'ban_user':
        return { banned: true, userId: 12345 };
      case 'mute_user':
        return { muted: true, userId: 12345, duration: 3600 };
      case 'restrict_user':
        return {
          restricted: true,
          userId: 12345,
          permissions: { canSendMessages: false },
        };
      case 'promote_user':
        return {
          promoted: true,
          userId: 12345,
          privileges: { canManageChat: true },
        };
      case 'create_poll':
        return { pollId: 'poll_123', question: 'Test poll?', sent: true };
      case 'answer_callback_query':
        return { answered: true, callbackQueryId: 'cq_123' };
      case 'api_call':
        return { statusCode: 200, body: { ok: true } };
      case 'delay':
        return { waited: '1s' };
      case 'bot_action':
        return { action: 'sendMessage', status: 200, executed: true };
      // Advanced
      case 'db_query':
        return { rows: 3 };
      case 'transform':
        return { transformed: true };
      case 'loop':
        return { loopCount: 3 };
      case 'switch':
        return { matchedCase: 'default' };
      case 'parallel_branch':
        return { branchCount: 2, results: {} };
      // New triggers
      case 'poll_answer':
        return { userId: 12345, pollId: 'poll_456', optionIds: [0, 2] };
      case 'inline_query':
        return {
          userId: 12345,
          queryId: 'iq_789',
          query: 'search term',
          offset: '',
        };
      case 'my_chat_member':
        return {
          chatId: '-100123456',
          oldStatus: 'member',
          newStatus: 'kicked',
        };
      case 'new_chat_title':
        return {
          chatId: '-100123456',
          userId: 12345,
          title: 'New Group Title',
        };
      case 'new_chat_photo':
        return { chatId: '-100123456', userId: 12345, photoUpdated: true };
      // New conditions
      case 'user_is_admin':
        return { isAdmin: true, status: 'administrator' };
      case 'message_length':
        return { length: 42, matched: true, threshold: 100 };
      case 'callback_data_match':
        return {
          matched: true,
          pattern: 'action:*',
          callbackData: 'action:confirm',
        };
      case 'user_is_bot':
        return { isBot: false, matched: true };
      // New actions
      case 'send_video':
        return {
          messageId: 1010,
          sent: true,
          videoUrl: 'https://example.com/video.mp4',
        };
      case 'send_document':
        return {
          messageId: 1011,
          sent: true,
          documentUrl: 'https://example.com/file.pdf',
        };
      case 'send_sticker':
        return { messageId: 1012, sent: true, sticker: 'CAACAgIAAxkBAAI...' };
      case 'send_location':
        return {
          messageId: 1013,
          sent: true,
          latitude: 51.5074,
          longitude: -0.1278,
        };
      case 'send_voice':
        return {
          messageId: 1014,
          sent: true,
          voiceUrl: 'https://example.com/voice.ogg',
        };
      case 'send_contact':
        return {
          messageId: 1015,
          sent: true,
          phoneNumber: '+1234567890',
          firstName: 'John',
        };
      case 'set_chat_title':
        return { chatId: '-100123456', title: 'New Title', updated: true };
      case 'set_chat_description':
        return {
          chatId: '-100123456',
          description: 'New description',
          updated: true,
        };
      case 'export_invite_link':
        return { inviteLink: 'https://t.me/+abc123xyz', chatId: '-100123456' };
      case 'get_chat_member':
        return { userId: 12345, status: 'member', canSendMessages: true };
      // Discord Triggers
      case 'discord_message_received':
        return {
          content: 'Hello!',
          author: { id: '123456789', username: 'TestUser' },
          channelId: '987654321',
          guildId: '111222333',
        };
      case 'discord_member_join':
        return {
          userId: '123456789',
          username: 'TestUser',
          guildId: '111222333',
        };
      case 'discord_member_leave':
        return {
          userId: '123456789',
          username: 'TestUser',
          guildId: '111222333',
        };
      case 'discord_reaction_add':
        return {
          userId: '123456789',
          messageId: '555666777',
          emoji: '👍',
          channelId: '987654321',
        };
      case 'discord_reaction_remove':
        return {
          userId: '123456789',
          messageId: '555666777',
          emoji: '👍',
          channelId: '987654321',
        };
      case 'discord_voice_state_update':
        return {
          userId: '123456789',
          channelId: '987654321',
          guildId: '111222333',
          selfMute: false,
        };
      case 'discord_interaction_create':
        return {
          interactionId: 'int_123',
          type: 2,
          commandName: 'test',
          userId: '123456789',
        };
      case 'discord_channel_create':
        return {
          channelId: '987654321',
          name: 'new-channel',
          type: 'text',
          guildId: '111222333',
        };
      case 'discord_channel_delete':
        return {
          channelId: '987654321',
          name: 'deleted-channel',
          guildId: '111222333',
        };
      case 'discord_role_update':
        return {
          roleId: '444555666',
          name: 'Updated Role',
          guildId: '111222333',
        };
      case 'discord_scheduled_event':
        return { eventId: 'evt_123', name: 'Test Event', guildId: '111222333' };
      // Discord Conditions
      case 'discord_has_role':
        return { hasRole: true, roleId: '444555666' };
      case 'discord_channel_type':
        return { channelType: 'text', matched: true };
      case 'discord_is_bot':
        return { isBot: false, matched: true };
      case 'discord_message_has_embed':
        return { hasEmbed: true, embedCount: 1 };
      case 'discord_member_permissions':
        return { hasPermissions: true, permissions: ['MANAGE_MESSAGES'] };
      // Discord Actions
      case 'discord_send_message':
        return { messageId: '888999000', sent: true, channelId: '987654321' };
      case 'discord_send_embed':
        return { messageId: '888999001', sent: true, channelId: '987654321' };
      case 'discord_send_dm':
        return { messageId: '888999002', sent: true, userId: '123456789' };
      case 'discord_edit_message':
        return { messageId: '555666777', edited: true };
      case 'discord_delete_message':
        return { messageId: '555666777', deleted: true };
      case 'discord_add_reaction':
        return { messageId: '555666777', emoji: '👍', added: true };
      case 'discord_remove_reaction':
        return { messageId: '555666777', emoji: '👍', removed: true };
      case 'discord_pin_message':
        return { messageId: '555666777', pinned: true };
      case 'discord_unpin_message':
        return { messageId: '555666777', unpinned: true };
      case 'discord_ban_member':
        return { userId: '123456789', banned: true };
      case 'discord_kick_member':
        return { userId: '123456789', kicked: true };
      case 'discord_timeout_member':
        return { userId: '123456789', timedOut: true, durationMs: 60000 };
      case 'discord_add_role':
        return { userId: '123456789', roleId: '444555666', added: true };
      case 'discord_remove_role':
        return { userId: '123456789', roleId: '444555666', removed: true };
      case 'discord_create_role':
        return { roleId: '777888999', name: 'New Role', created: true };
      case 'discord_set_nickname':
        return { userId: '123456789', nickname: 'NewNick', updated: true };
      case 'discord_create_channel':
        return { channelId: '999888777', name: 'new-channel', created: true };
      case 'discord_delete_channel':
        return { channelId: '987654321', deleted: true };
      case 'discord_move_member':
        return { userId: '123456789', channelId: '987654321', moved: true };
      case 'discord_create_thread':
        return { threadId: '111000999', name: 'New Thread', created: true };
      case 'discord_send_thread_message':
        return { messageId: '888999003', threadId: '111000999', sent: true };
      case 'discord_create_invite':
        return { inviteCode: 'abc123', url: 'https://discord.gg/abc123' };
      case 'discord_create_scheduled_event':
        return { eventId: 'evt_456', name: 'Scheduled Event', created: true };
      default:
        return { executed: true };
    }
  }

  // =========================================================================
  // Trigger Registry
  // =========================================================================

  async getTriggerRegistry() {
    if (this.triggerRegistryCache) {
      return {
        triggers: this.triggerRegistryCache,
        version: this.triggerRegistryVersion,
      };
    }
    return this.rebuildTriggerRegistry();
  }

  getTriggerRegistryVersion() {
    return { version: this.triggerRegistryVersion };
  }

  async rebuildTriggerRegistry() {
    const activeFlows = await this.prisma.flowDefinition.findMany({
      where: { status: 'active' },
      select: { id: true, nodesJson: true, platform: true },
    });

    const triggers: Array<{
      flowId: string;
      nodeType: string;
      config: Record<string, unknown>;
      platform: string;
    }> = [];

    for (const flow of activeFlows) {
      const nodes = flow.nodesJson as Array<{
        id: string;
        type: string;
        category: string;
        config: Record<string, unknown>;
      }>;

      if (!Array.isArray(nodes)) continue;

      for (const node of nodes) {
        if (node.category === 'trigger') {
          triggers.push({
            flowId: flow.id,
            nodeType: node.type,
            config: node.config,
            platform: flow.platform,
          });
        }
      }
    }

    this.triggerRegistryCache = triggers;
    this.triggerRegistryVersion++;
    return { triggers, version: this.triggerRegistryVersion };
  }

  // =========================================================================
  // Circular Reference Detection
  // =========================================================================

  async detectRunFlowCycles(flowId: string): Promise<string[] | null> {
    const visited = new Set<string>();
    const path: string[] = [];

    const getReferencedFlows = async (fid: string): Promise<string[]> => {
      const flow = await this.prisma.flowDefinition.findUnique({
        where: { id: fid },
        select: { nodesJson: true },
      });
      if (!flow) return [];
      const nodes = flow.nodesJson as Array<{
        type: string;
        config: { flowId?: string };
      }>;
      if (!Array.isArray(nodes)) return [];
      return nodes
        .filter((n) => n.type === 'run_flow' && n.config?.flowId)
        .map((n) => n.config.flowId!);
    };

    const dfs = async (current: string): Promise<boolean> => {
      if (path.includes(current)) {
        path.push(current);
        return true;
      }
      if (visited.has(current)) return false;

      path.push(current);
      const refs = await getReferencedFlows(current);
      for (const ref of refs) {
        if (await dfs(ref)) return true;
      }
      path.pop();
      visited.add(current);
      return false;
    };

    const hasCycle = await dfs(flowId);
    return hasCycle ? path : null;
  }

  // =========================================================================
  // Context Keys
  // =========================================================================

  async getContextKeys(): Promise<Array<{ key: string; count: number }>> {
    const result = await this.prisma.userFlowContext.groupBy({
      by: ['key'],
      _count: { key: true },
      orderBy: { _count: { key: 'desc' } },
      take: 100,
    });
    return result.map((r) => ({ key: r.key, count: r._count.key }));
  }

  // =========================================================================
  // Flow Folders
  // =========================================================================

  private readonly MAX_FOLDER_DEPTH = 3;

  async createFolder(name: string, parentId?: string) {
    if (parentId) {
      const depth = await this.getFolderDepth(parentId);
      if (depth >= this.MAX_FOLDER_DEPTH) {
        throw new BadRequestException(
          `Maximum folder depth (${this.MAX_FOLDER_DEPTH}) exceeded`,
        );
      }
    }
    return this.prisma.flowFolder.create({ data: { name, parentId } });
  }

  async getFolders() {
    return this.prisma.flowFolder.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: true,
            flows: { select: { id: true, name: true, status: true } },
          },
        },
        flows: { select: { id: true, name: true, status: true } },
      },
      orderBy: { order: 'asc' },
    });
  }

  async updateFolder(
    id: string,
    data: { name?: string; parentId?: string; order?: number },
  ) {
    if (data.parentId) {
      const depth = await this.getFolderDepth(data.parentId);
      if (depth >= this.MAX_FOLDER_DEPTH) {
        throw new BadRequestException(
          `Maximum folder depth (${this.MAX_FOLDER_DEPTH}) exceeded`,
        );
      }
    }
    return this.prisma.flowFolder.update({ where: { id }, data });
  }

  async deleteFolder(id: string) {
    await this.prisma.flowDefinition.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    });
    return this.prisma.flowFolder.delete({ where: { id } });
  }

  private async getFolderDepth(folderId: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = folderId;
    while (currentId) {
      depth++;
      const folder = await this.prisma.flowFolder.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      currentId = folder?.parentId ?? null;
    }
    return depth;
  }
}
