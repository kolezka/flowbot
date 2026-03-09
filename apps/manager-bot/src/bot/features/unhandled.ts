import type { Context } from '../context.js'
import { Composer } from 'grammy'

export const unhandledFeature = new Composer<Context>()

unhandledFeature.on('message', (ctx) => {
  ctx.logger.debug('Unhandled message')
})
