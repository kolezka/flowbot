import type { Middleware } from 'grammy'
import type { Context } from '../context.js'
import { toUserDataUpsertDTO } from '../../adapters/toUserDataUpsertDTO.js'
import { UserRepository } from '../../repositories/UserRepository.js'
import type { PrismaClient } from '@flowbot/db'

export function userDataMiddleware(prisma: PrismaClient): Middleware<Context> {
  const userRepository = new UserRepository(prisma)

  return async (ctx, next) => {
    if (ctx.from) {
      try {
        const userDataUpsertDTO = toUserDataUpsertDTO(ctx)
        const userData = await userRepository.upsert(userDataUpsertDTO)
        ctx.session.userData = userData
        ctx.logger.debug({
          msg: 'User data upserted successfully',
          userId: userData.telegramId.toString(),
        })
      }
      catch (e) {
        ctx.logger.error({
          msg: 'Failed to upsert user data',
          err: e,
        })
      }
    }
    return next()
  }
}
