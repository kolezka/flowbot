import type { Middleware } from 'grammy'
import type { Context } from '../context.js'

export function updateLogger(): Middleware<Context> {
  return async (ctx, next) => {
    ctx.logger.debug({
      msg: 'Update received',
      update_id: ctx.update.update_id,
      chat_id: ctx.chat?.id,
      from_id: ctx.from?.id,
      type: ctx.update ? Object.keys(ctx.update).find(k => k !== 'update_id') : undefined,
    })
    await next()
  }
}
