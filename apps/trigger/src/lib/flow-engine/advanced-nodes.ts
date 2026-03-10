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
