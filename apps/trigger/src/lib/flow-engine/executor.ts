import type { FlowNode, FlowEdge, FlowContext, NodeResult, ErrorHandling } from './types.js';
import { evaluateCondition } from './conditions.js';
import { executeAction } from './actions.js';
import { interpolate } from './variables.js';
import { executeParallelBranch, executeDbQuery, executeLoop, evaluateSwitch, executeTransform, executeNotification } from './advanced-nodes.js';

export interface ExecutorConfig {
  defaultErrorHandling: ErrorHandling;
  maxNodes: number;
  enableNodeCache: boolean;
  maxCacheSize: number;
  prisma?: any;
}

const DEFAULT_CONFIG: ExecutorConfig = {
  defaultErrorHandling: 'stop',
  maxNodes: 100,
  enableNodeCache: true,
  maxCacheSize: 1000,
};

/** Set of node types that produce side effects and must not be cached. */
const NON_CACHEABLE_TYPES = new Set([
  'delay', 'send_message', 'send_photo', 'forward_message', 'copy_message',
  'edit_message', 'delete_message', 'pin_message', 'unpin_message',
  'ban_user', 'mute_user', 'restrict_user', 'promote_user',
  'create_poll', 'answer_callback_query',
  'bot_action', 'api_call', 'db_query', 'parallel_branch', 'notification',
  'send_video', 'send_document', 'send_sticker', 'send_location',
  'send_voice', 'send_contact', 'set_chat_title', 'set_chat_description',
  'export_invite_link', 'get_chat_member',
  'send_animation', 'send_venue', 'send_dice', 'send_media_group',
  'send_audio', 'leave_chat', 'get_chat_info', 'set_chat_photo',
  'delete_chat_photo', 'approve_join_request',
]);

/**
 * Build a cache key for a node based on its type, config, and resolved inputs.
 * Returns null if the node is not cacheable (e.g. delay, side-effect actions).
 */
function buildNodeCacheKey(node: FlowNode, ctx: FlowContext): string | null {
  if (NON_CACHEABLE_TYPES.has(node.type)) return null;

  const configStr = JSON.stringify(node.config);
  const resolvedConfig = interpolate(configStr, ctx);
  return `${node.type}::${resolvedConfig}`;
}

/**
 * Simple LRU cache backed by a Map (which preserves insertion order).
 * When the cache exceeds maxSize, the oldest entries are evicted.
 */
class LRUCache<V> {
  private map = new Map<string, V>();
  constructor(private maxSize: number) {}

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // Evict oldest entry (first key in iteration order)
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, value);
  }

  get size(): number {
    return this.map.size;
  }
}

/**
 * Build a reverse adjacency map: for each node, which nodes point TO it.
 * Used for subtree short-circuit evaluation.
 */
function buildReverseAdjacency(edges: FlowEdge[]): Map<string, string[]> {
  const reverse = new Map<string, string[]>();
  for (const edge of edges) {
    if (!reverse.has(edge.target)) reverse.set(edge.target, []);
    reverse.get(edge.target)!.push(edge.source);
  }
  return reverse;
}

/**
 * Compute the set of nodes reachable from `startId` via forward edges.
 */
function getReachableNodes(startId: string, adjacency: Map<string, string[]>): Set<string> {
  const reachable = new Set<string>();
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const next of adjacency.get(id) ?? []) {
      if (!reachable.has(next)) stack.push(next);
    }
  }
  return reachable;
}

/**
 * Find nodes in the subtree that can be short-circuited (skipped) when a
 * condition node fails. A downstream node can be skipped only if ALL of its
 * incoming edges originate from nodes that are within the subtree — i.e. there
 * is no alternative path that could still reach it.
 */
function getSkippableSubtree(
  conditionNodeId: string,
  adjacency: Map<string, string[]>,
  reverseAdj: Map<string, string[]>,
): Set<string> {
  const reachable = getReachableNodes(conditionNodeId, adjacency);
  reachable.delete(conditionNodeId); // don't include the condition node itself

  const skippable = new Set<string>();
  // Iterate in a stable order: keep adding nodes whose parents are all skippable or the condition itself
  let changed = true;
  while (changed) {
    changed = false;
    for (const nodeId of reachable) {
      if (skippable.has(nodeId)) continue;
      const parents = reverseAdj.get(nodeId) ?? [];
      const allParentsSkippable = parents.every(
        (p) => p === conditionNodeId || skippable.has(p),
      );
      if (allParentsSkippable) {
        skippable.add(nodeId);
        changed = true;
      }
    }
  }
  return skippable;
}

export interface FlowExecutionMetrics {
  durationMs: number;
  nodeCount: number;
  cacheHits: number;
  cacheMisses: number;
  cacheSize: number;
  skippedNodes: number;
}

export async function executeFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  triggerData: Record<string, unknown>,
  config: Partial<ExecutorConfig> = {},
): Promise<FlowContext> {
  const startTime = performance.now();
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

  // Node result cache with LRU eviction
  const nodeCache = new LRUCache<unknown>(cfg.maxCacheSize);
  let cacheHits = 0;
  let cacheMisses = 0;

  // Pre-compute adjacency list (forward and reverse) once
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }
  const reverseAdj = buildReverseAdjacency(edges);

  // Pre-build node lookup map
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Find trigger nodes (entry points)
  const triggerNodes = nodes.filter((n) => n.category === 'trigger');

  // BFS execution from trigger nodes
  const queue: string[] = triggerNodes.map((n) => n.id);
  const visited = new Set<string>();
  let executedCount = 0;
  let skippedNodes = 0;

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
        cacheHits++;
      } else if (node.category === 'trigger') {
        output = triggerData;
      } else if (node.category === 'condition') {
        if (cacheKey) cacheMisses++;
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
        if (cacheKey) cacheMisses++;
        output = await executeAction(node, ctx);
      }

      // Store in cache if cacheable (LRU handles eviction)
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
      } else {
        // Short-circuit: skip entire subtree when condition fails and
        // all downstream nodes depend solely on this condition path
        const skippable = getSkippableSubtree(nodeId, adjacency, reverseAdj);
        for (const skipId of skippable) {
          if (!visited.has(skipId)) {
            visited.add(skipId);
            skippedNodes++;
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

  const durationMs = performance.now() - startTime;

  // Expose batched variable writes for callers who need to persist only changed variables
  (ctx as any)._pendingVariableWrites = Object.fromEntries(pendingVariables);

  // Expose performance metrics
  (ctx as any)._metrics = {
    durationMs,
    nodeCount: executedCount,
    cacheHits,
    cacheMisses,
    cacheSize: nodeCache.size,
    skippedNodes,
  } satisfies FlowExecutionMetrics;

  return ctx;
}
