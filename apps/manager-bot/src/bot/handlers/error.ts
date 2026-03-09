import type { ErrorHandler } from 'grammy'
import type { Context } from '../context.js'
import { getUpdateInfo } from '../helpers/logging.js'

export const errorHandler: ErrorHandler<Context> = (error) => {
  const { ctx } = error

  ctx.logger.error({
    err: error.error,
    update: getUpdateInfo(ctx),
  })
}
