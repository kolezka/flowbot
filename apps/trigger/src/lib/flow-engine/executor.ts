import type { FlowNode, FlowEdge, FlowContext, NodeResult, ErrorHandling } from './types.js';
import { evaluateCondition } from './conditions.js';
import { executeAction } from './actions.js';
import { interpolate } from './variables.js';
import { executeParallelBranch, executeDbQuery, executeLoop, evaluateSwitch, executeTransform, executeNotification } from './advanced-nodes.js';

export interface ExecutorConfig {
  defaultErrorHandling: ErrorHandling;
  maxNodes: number;
  enableNodeCache: boolean;
  prisma?: any;
}

const DEFAULT_CONFIG: ExecutorConfig = {
  defaultErrorHandling: 'stop',
  maxNodes: 100,
  enableNodeCache: true,
};

/**
 * Build a cache key for a node based on its type, config, and resolved inputs.
 * Returns null if the node is not cacheable (e.g. delay, side-effect actions).
 */
function buildNodeCacheKey(node: FlowNode, ctx: FlowContext): string | null {
  // Side-effect nodes should never be cached
  const nonCacheableTypes = new Set([
    'delay', 'send_message', 'forward_message', 'ban_user', 'mute_user',
    'bot_action', 'api_call', 'db_query', 'parallel_branch', 'notification',
  ]);
  if (nonCacheableTypes.has(node.type)) return null;

  const configStr = JSON.stringify(node.config);
  const resolvedConfig = interpolate(configStr, ctx);
  return `${node.type}::${resolvedConfig}`;
}

export async function executeFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  triggerData: Record<string, unknown>,
  config: Partial<ExecutorConfig> = {},
): Promise<FlowContext> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Batch context writes: collect variable updates, flush at end
  const pendingVariables = new Map<string, unknown>();
  const ctx: FlowContext = {
    flowId: '',
    executionId: '',
    variables: new Map(),
    triggerData,
    nodeResults: new Map(),
  };

  // Wrap variables.set to track pending writes for batch persistence
  const originalSet = ctx.variables.set.bind(ctx.variables);
  ctx.variables.set = (key: string, value: unknown) => {
    pendingVariables.set(key, value);
    return originalSet(key, value);
  };

  // Node result cache: skip re-executing nodes with same inputs
  const nodeCache = new Map<string, unknown>();

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }

  // Find trigger nodes (entry points)
  const triggerNodes = nodes.filter((n) => n.category === 'trigger');
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // BFS execution from trigger nodes
  const queue: string[] = triggerNodes.map((n) => n.id);
  const visited = new Set<string>();
  let executedCount = 0;

  while (queue.length > 0 && executedCount < cfg.maxNodes) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) continue;

    executedCount++;
    const startedAt = new Date();

    try {
      let output: unknown;
      let shouldContinue = true;

      // Check node cache for cacheable nodes
      const cacheKey = cfg.enableNodeCache ? buildNodeCacheKey(node, ctx) : null;
      if (cacheKey && nodeCache.has(cacheKey)) {
        output = nodeCache.get(cacheKey);
      } else if (node.category === 'trigger') {
        output = triggerData;
      } else if (node.category === 'condition') {
        const result = await evaluateCondition(node, ctx);
        output = result;
        shouldContinue = !!result;
      } else if (node.type === 'parallel_branch') {
        const branchTargets = adjacency.get(nodeId) ?? [];
        output = await executeParallelBranch(
          { ...node, config: { ...node.config, branches: branchTargets } },
          ctx,
          async (branchId: string) => {
            const branchNode = nodeMap.get(branchId);
            if (!branchNode) return null;
            if (branchNode.category === 'action') return executeAction(branchNode, ctx);
            if (branchNode.category === 'condition') return evaluateCondition(branchNode, ctx);
            return null;
          },
        );
        // Mark branch targets as visited since they were executed in parallel
        for (const t of branchTargets) visited.add(t);
      } else if (node.type === 'db_query') {
        if (!cfg.prisma) throw new Error('Prisma client required for db_query nodes');
        output = await executeDbQuery(node, ctx, cfg.prisma);
      } else if (node.category === 'action') {
        output = await executeAction(node, ctx);
      }

      // Store in cache if cacheable
      if (cacheKey && !nodeCache.has(cacheKey)) {
        nodeCache.set(cacheKey, output);
      }

      const result: NodeResult = {
        nodeId,
        status: 'success',
        output,
        startedAt,
        completedAt: new Date(),
      };
      ctx.nodeResults.set(nodeId, result);

      // Continue to next nodes only if condition passed
      if (shouldContinue) {
        const nextNodes = adjacency.get(nodeId) ?? [];
        for (const nextId of nextNodes) {
          if (!visited.has(nextId)) {
            queue.push(nextId);
          }
        }
      }
    } catch (error) {
      const errorHandling = (node.config.errorHandling as ErrorHandling) ?? cfg.defaultErrorHandling;
      const errorMsg = error instanceof Error ? error.message : String(error);

      const result: NodeResult = {
        nodeId,
        status: 'error',
        error: errorMsg,
        startedAt,
        completedAt: new Date(),
      };
      ctx.nodeResults.set(nodeId, result);

      if (errorHandling === 'stop') {
        break;
      }
      // 'skip' continues to next nodes
      if (errorHandling === 'skip') {
        const nextNodes = adjacency.get(nodeId) ?? [];
        for (const nextId of nextNodes) {
          if (!visited.has(nextId)) queue.push(nextId);
        }
      }
    }
  }

  // Expose batched variable writes for callers who need to persist only changed variables
  (ctx as any)._pendingVariableWrites = Object.fromEntries(pendingVariables);

  return ctx;
}
