import type { PrismaClient } from '@flowbot/db'
import type { Middleware } from 'grammy'
import type { Context } from '../context.js'
import { GroupConfigRepository } from '../../repositories/GroupConfigRepository.js'
import { GroupRepository } from '../../repositories/GroupRepository.js'

export function groupData(prisma: PrismaClient): Middleware<Context> {
  const groupRepo = new GroupRepository(prisma)
  const configRepo = new GroupConfigRepository(prisma)

  return async (ctx, next) => {
    const chatType = ctx.chat?.type
    if (chatType !== 'group' && chatType !== 'supergroup') {
      return next()
    }

    const chatId = BigInt(ctx.chat!.id)
    const title = ctx.chat!.title

    const group = await groupRepo.upsertGroup(chatId, title)
    const groupConfig = await configRepo.findOrCreate(group.id)

    ctx.session.groupConfig = groupConfig

    return next()
  }
}
