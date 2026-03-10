import type { FlowNode, FlowContext } from './types.js';
import { interpolate } from './variables.js';

export async function evaluateCondition(node: FlowNode, ctx: FlowContext): Promise<boolean> {
  switch (node.type) {
    case 'keyword_match':
      return evaluateKeywordMatch(node, ctx);
    case 'user_role':
      return evaluateUserRole(node, ctx);
    case 'time_based':
      return evaluateTimeBased(node, ctx);
    default:
      return true;
  }
}

function evaluateKeywordMatch(node: FlowNode, ctx: FlowContext): boolean {
  const keywords = (node.config.keywords as string[]) ?? [];
  const text = String(ctx.triggerData.text ?? '').toLowerCase();
  const mode = (node.config.mode as string) ?? 'any'; // any | all

  if (mode === 'all') {
    return keywords.every((kw) => text.includes(kw.toLowerCase()));
  }
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

function evaluateUserRole(node: FlowNode, ctx: FlowContext): boolean {
  const requiredRoles = (node.config.roles as string[]) ?? [];
  const userRole = String(ctx.triggerData.userRole ?? 'member');
  return requiredRoles.includes(userRole);
}

function evaluateTimeBased(node: FlowNode, ctx: FlowContext): boolean {
  const now = new Date();
  const startHour = (node.config.startHour as number) ?? 0;
  const endHour = (node.config.endHour as number) ?? 24;
  const currentHour = now.getHours();
  return currentHour >= startHour && currentHour < endHour;
}
