import { logger } from '@trigger.dev/sdk/v3';
import type { FlowContext } from './types.js';
import { dispatchUserAction } from './user-actions.js';

/**
 * Unified platform-agnostic dispatch.
 *
 * All platform connectors (Telegram bot, Discord bot, WhatsApp user, etc.) expose
 * the same HTTP contract: POST /execute with { action, params }.
 * The dispatcher simply looks up the bot instance's apiUrl and forwards the call.
 */
export async function dispatchAction(
  action: string,
  params: Record<string, unknown>,
  apiUrl: string,
  instanceId?: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const response = await fetch(`${apiUrl}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params, ...(instanceId && { instanceId }) }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    return { success: false, error: `Connector returned ${response.status}: ${text}` }
  }

  return response.json() as Promise<{ success: boolean; data?: unknown; error?: string }>
}

export interface DispatchResult {
  nodeId: string;
  dispatched: boolean;
  response?: unknown;
  error?: string;
}

/** Actions that don't need external dispatch (already fully executed during flow). */
const INTERNAL_ACTIONS = new Set([
  'delay', 'api_call', 'db_query', 'transform', 'loop', 'switch',
  'parallel_branch', 'notification',
  'get_context', 'set_context', 'delete_context', 'run_flow', 'emit_event',
  'bot_action',
]);

/**
 * After flow execution, dispatch action results to the appropriate connector.
 * All platforms use the same contract: POST /execute with { action, params }.
 */
export async function dispatchActions(
  ctx: FlowContext,
  transportConfig?: {
    transport?: string;
    botInstanceId?: string;
    platformConnectionId?: string;
  },
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = [];
  const botInstanceId = transportConfig?.botInstanceId;

  for (const [nodeId, result] of ctx.nodeResults) {
    if (result.status !== 'success' || !result.output) continue;

    const output = result.output as Record<string, unknown>;
    const action = output.action as string | undefined;
    if (!action || !output.executed) continue;

    if (INTERNAL_ACTIONS.has(action)) continue;

    // User account actions (MTProto/WhatsApp user) — dispatched via PlatformConnection
    if (action.startsWith('user_')) {
      const nodeConfig = output.connectionOverride as string | undefined;
      const connectionId = nodeConfig ?? transportConfig?.platformConnectionId;

      if (!connectionId) {
        results.push({ nodeId, dispatched: false, error: 'User account connection required for user_* actions' });
        continue;
      }

      const userResult = await dispatchUserAction(action, output, connectionId);
      results.push({ ...userResult, nodeId });
      continue;
    }

    // All other actions: route to the bot instance connector via POST /execute
    try {
      if (!botInstanceId) {
        throw new Error(`Action '${action}' requires a botInstanceId in transportConfig`);
      }

      const { getPrisma } = await import('../prisma.js');
      const prisma = getPrisma();

      const botInstance = await prisma.botInstance.findUnique({
        where: { id: botInstanceId },
        select: { apiUrl: true, isActive: true },
      });

      if (!botInstance?.apiUrl || !botInstance.isActive) {
        throw new Error(`Bot instance ${botInstanceId} not available`);
      }

      const response = await dispatchAction(action, output, botInstance.apiUrl, botInstanceId);
      results.push({ nodeId, dispatched: true, response });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Dispatch failed for ${action} on node ${nodeId}: ${msg}`);
      results.push({ nodeId, dispatched: false, error: msg });
    }
  }

  return results;
}
