import type { FlowNode, FlowEdge, FlowContext, NodeResult, ErrorHandling } from './types.js';
import { evaluateCondition } from './conditions.js';
import { executeAction } from './actions.js';
import { interpolate } from './variables.js';

export interface ExecutorConfig {
  defaultErrorHandling: ErrorHandling;
  maxNodes: number;
}

const DEFAULT_CONFIG: ExecutorConfig = {
  defaultErrorHandling: 'stop',
  maxNodes: 100,
};

export async function executeFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  triggerData: Record<string, unknown>,
  config: Partial<ExecutorConfig> = {},
): Promise<FlowContext> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const ctx: FlowContext = {
    flowId: '',
    executionId: '',
    variables: new Map(),
    triggerData,
    nodeResults: new Map(),
  };

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

      if (node.category === 'trigger') {
        output = triggerData;
      } else if (node.category === 'condition') {
        const result = await evaluateCondition(node, ctx);
        output = result;
        shouldContinue = !!result;
      } else if (node.category === 'action') {
        output = await executeAction(node, ctx);
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

  return ctx;
}
