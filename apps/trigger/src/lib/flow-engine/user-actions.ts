import { logger } from '@trigger.dev/sdk/v3';
import { dispatchAction, type DispatchResult } from './dispatcher.js';

const CONNECTOR_POOL_URL = process.env.CONNECTOR_POOL_URL ?? 'http://localhost:3010';

/**
 * Dispatch a user_* action via the connector pool's HTTP /execute endpoint.
 * The pool routes to the correct telegram-user worker by connectionId (used as instanceId).
 */
export async function dispatchUserAction(
  action: string,
  params: Record<string, unknown>,
  connectionId: string,
): Promise<DispatchResult> {
  if (!action.startsWith('user_')) {
    return { nodeId: '', dispatched: false, error: `'${action}' is not a user account action` };
  }

  try {
    const response = await dispatchAction(action, params, CONNECTOR_POOL_URL, connectionId);

    if (!response.success) {
      return { nodeId: '', dispatched: false, error: response.error ?? 'Unknown error' };
    }

    return { nodeId: '', dispatched: true, response: response.data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`User action dispatch failed for ${action}: ${msg}`);
    return { nodeId: '', dispatched: false, error: msg };
  }
}
