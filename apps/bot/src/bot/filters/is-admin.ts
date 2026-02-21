import type { Context } from '../context'

export function isAdmin(ctx: Context) {
  return !!ctx.from && ctx.config.botAdmins.includes(ctx.from.id)
}
