import type { FlowContext } from './types.js';

export function interpolate(template: string, ctx: FlowContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmed = path.trim();

    // Check trigger data
    if (trimmed.startsWith('trigger.')) {
      const key = trimmed.slice(8);
      const value = getNestedValue(ctx.triggerData, key);
      return value !== undefined ? String(value) : match;
    }

    // Check context cache
    if (trimmed.startsWith('context.')) {
      const contextKey = trimmed.slice('context.'.length);
      const contextCache = (ctx as any)._contextCache as Map<string, unknown> | undefined;
      if (contextCache?.has(contextKey)) {
        return String(contextCache.get(contextKey) ?? '');
      }
      return match;
    }

    // Check node results
    if (trimmed.startsWith('node.')) {
      const [, nodeId, ...rest] = trimmed.split('.');
      const result = ctx.nodeResults.get(nodeId!);
      if (result?.output) {
        const value = getNestedValue(result.output as Record<string, unknown>, rest.join('.'));
        return value !== undefined ? String(value) : match;
      }
      return match;
    }

    // Check variables
    const value = ctx.variables.get(trimmed);
    return value !== undefined ? String(value) : match;
  });
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function setVariable(ctx: FlowContext, key: string, value: unknown): void {
  ctx.variables.set(key, value);
}

export function getVariable(ctx: FlowContext, key: string): unknown {
  return ctx.variables.get(key);
}
