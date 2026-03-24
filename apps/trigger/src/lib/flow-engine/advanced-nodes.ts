import type { FlowNode, FlowContext } from './types.js';
import { interpolate } from './variables.js';

// AF-01: Loop node
export async function executeLoop(
  node: FlowNode,
  ctx: FlowContext,
  executeChildren: (item: unknown, index: number) => Promise<void>,
): Promise<unknown> {
  const arrayVar = String(node.config.arrayVariable ?? '');
  const items = ctx.variables.get(arrayVar);

  if (!Array.isArray(items)) {
    return { loopCount: 0, error: `Variable ${arrayVar} is not an array` };
  }

  for (let i = 0; i < items.length; i++) {
    ctx.variables.set('loop.index', i);
    ctx.variables.set('loop.item', items[i]);
    await executeChildren(items[i], i);
  }

  ctx.variables.delete('loop.index');
  ctx.variables.delete('loop.item');
  return { loopCount: items.length };
}

// AF-03: Switch/router node
export function evaluateSwitch(node: FlowNode, ctx: FlowContext): string {
  const value = interpolate(String(node.config.switchValue ?? ''), ctx);
  const cases = (node.config.cases as Array<{ value: string; output: string }>) ?? [];

  for (const c of cases) {
    if (value === c.value) return c.output;
  }
  return (node.config.defaultOutput as string) ?? 'default';
}

// AF-04: Transform node
export function executeTransform(node: FlowNode, ctx: FlowContext): unknown {
  const operation = String(node.config.operation ?? 'passthrough');
  const input = interpolate(String(node.config.input ?? ''), ctx);

  switch (operation) {
    case 'uppercase':
      return input.toUpperCase();
    case 'lowercase':
      return input.toLowerCase();
    case 'trim':
      return input.trim();
    case 'json_parse':
      return JSON.parse(input);
    case 'json_stringify':
      return JSON.stringify(input);
    case 'split':
      return input.split(String(node.config.delimiter ?? ','));
    case 'regex_extract': {
      const pattern = String(node.config.pattern ?? '');
      const match = input.match(new RegExp(pattern));
      return match ? match[0] : null;
    }
    default:
      return input;
  }
}

// AF-02: Parallel branch node
export async function executeParallelBranch(
  node: FlowNode,
  ctx: FlowContext,
  executeBranch: (branchId: string) => Promise<unknown>,
): Promise<unknown> {
  const branches = (node.config.branches as string[]) ?? [];

  if (branches.length === 0) {
    return { branchCount: 0, results: {} };
  }

  const results = await Promise.all(
    branches.map(async (branchId) => {
      try {
        const output = await executeBranch(branchId);
        return { branchId, status: 'success' as const, output };
      } catch (error) {
        return {
          branchId,
          status: 'error' as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const collected: Record<string, unknown> = {};
  for (const r of results) {
    collected[r.branchId] = r.status === 'success' ? r.output : { error: r.error };
    ctx.variables.set(`parallel.${r.branchId}`, r.status === 'success' ? r.output : null);
  }

  return { branchCount: branches.length, results: collected };
}

// AF-05: Database query node
const DB_QUERY_ALLOWLIST = new Set([
  'user.count',
  'user.findMany',
  'product.count',
  'product.findMany',
]);

export async function executeDbQuery(
  node: FlowNode,
  ctx: FlowContext,
  prisma: any,
): Promise<unknown> {
  const query = String(node.config.query ?? '');

  if (!DB_QUERY_ALLOWLIST.has(query)) {
    throw new Error(`Query "${query}" is not in the allowlist. Allowed: ${[...DB_QUERY_ALLOWLIST].join(', ')}`);
  }

  const [model, operation] = query.split('.') as [string, string];
  const whereRaw = (node.config.where as Record<string, unknown>) ?? {};
  const selectRaw = (node.config.select as Record<string, boolean>) ?? undefined;

  const delegate = prisma[model];
  if (!delegate) {
    throw new Error(`Unknown model: ${model}`);
  }

  if (operation === 'count') {
    const count = await delegate.count({ where: whereRaw });
    return { query, count };
  }

  if (operation === 'findMany') {
    const takeRaw = (node.config.take as number) ?? 20;
    const take = Math.min(Math.max(1, takeRaw), 100);
    const skipRaw = (node.config.skip as number) ?? 0;
    const skip = Math.max(0, skipRaw);

    const args: any = { where: whereRaw, take, skip };
    if (selectRaw) args.select = selectRaw;

    const records = await delegate.findMany(args);
    return { query, count: records.length, data: records };
  }

  throw new Error(`Unsupported operation: ${operation}`);
}

// AF-06: Notification node
export async function executeNotification(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const channel = String(node.config.channel ?? 'websocket');
  const message = interpolate(String(node.config.message ?? ''), ctx);

  // In production these would call actual notification services
  return {
    action: 'notification',
    channel,
    message,
    executed: true,
    timestamp: new Date().toISOString(),
  };
}
