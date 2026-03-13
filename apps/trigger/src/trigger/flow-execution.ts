import { task } from '@trigger.dev/sdk/v3';
import { getPrisma } from '../lib/prisma.js';
import { executeFlow } from '../lib/flow-engine/index.js';
import type { FlowNode, FlowEdge } from '../lib/flow-engine/index.js';
import { enrichTriggerData } from '../lib/event-correlator.js';
import { dispatchActions } from '../lib/flow-engine/dispatcher.js';

export const flowExecutionTask = task({
  id: 'flow-execution',
  queue: { name: 'flows', concurrencyLimit: 5 },
  run: async (payload: { flowId: string; triggerData: Record<string, unknown> }) => {
    const prisma = getPrisma();
    const flow = await prisma.flowDefinition.findUnique({
      where: { id: payload.flowId },
    });

    if (!flow || flow.status !== 'active') {
      throw new Error(`Flow ${payload.flowId} not found or not active`);
    }

    const execution = await prisma.flowExecution.create({
      data: {
        flowId: payload.flowId,
        status: 'running',
        triggerData: payload.triggerData as any,
      },
    });

    try {
      const nodes = flow.nodesJson as unknown as FlowNode[];
      const edges = flow.edgesJson as unknown as FlowEdge[];
      const transportConfig = (flow as any).transportConfig as { transport?: string; botInstanceId?: string } | undefined;

      // Enrich trigger data with cross-bot event correlation context
      const enrichedTriggerData = await enrichTriggerData(payload.triggerData);

      const ctx = await executeFlow(nodes, edges, enrichedTriggerData);

      // Dispatch action results to Telegram
      const dispatchResults = await dispatchActions(ctx, transportConfig);

      // Merge dispatch metadata into node results
      for (const dr of dispatchResults) {
        const existing = ctx.nodeResults.get(dr.nodeId);
        if (existing) {
          existing.output = {
            ...(existing.output as Record<string, unknown> | undefined),
            _dispatch: {
              dispatched: dr.dispatched,
              response: dr.response,
              error: dr.error,
            },
          };
          if (!dr.dispatched && dr.error) {
            existing.status = 'error';
            existing.error = `Dispatch failed: ${dr.error}`;
          }
        }
      }

      const nodeResults = Object.fromEntries(
        Array.from(ctx.nodeResults.entries()).map(([k, v]) => [k, {
          status: v.status,
          output: v.output,
          error: v.error,
        }]),
      );

      const hasErrors = Array.from(ctx.nodeResults.values()).some((r) => r.status === 'error');

      await prisma.flowExecution.update({
        where: { id: execution.id },
        data: {
          status: hasErrors ? 'failed' : 'completed',
          nodeResults: nodeResults as any,
          completedAt: new Date(),
        },
      });

      return { executionId: execution.id, status: hasErrors ? 'failed' : 'completed' };
    } catch (error) {
      await prisma.flowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      });
      throw error;
    }
  },
});
