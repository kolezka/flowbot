import type { PrismaClient } from '@flowbot/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { MemberRepository } from '../../repositories/MemberRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

export function createPermissionsFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const memberRepo = new MemberRepository(prisma)

  feature.command('mod', requirePermission('admin', prisma), logHandle('cmd:mod'), async (ctx) => {
    const replyTo = ctx.message?.reply_to_message
    const targetUser = replyTo?.from

    if (!targetUser) {
      await ctx.reply('Reply to a user\'s message to make them a moderator.')
      return
    }

    const group = await prisma.managedGroup.findUnique({
      where: { chatId: BigInt(ctx.chat.id) },
    })
    if (!group)
      return

    await memberRepo.setRole(group.id, BigInt(targetUser.id), 'moderator')

    const name = targetUser.username ? `@${targetUser.username}` : targetUser.first_name
    await ctx.reply(`${name} is now a moderator.`)
  })

  feature.command('unmod', requirePermission('admin', prisma), logHandle('cmd:unmod'), async (ctx) => {
    const replyTo = ctx.message?.reply_to_message
    const targetUser = replyTo?.from

    if (!targetUser) {
      await ctx.reply('Reply to a user\'s message to remove their moderator role.')
      return
    }

    const group = await prisma.managedGroup.findUnique({
      where: { chatId: BigInt(ctx.chat.id) },
    })
    if (!group)
      return

    await memberRepo.setRole(group.id, BigInt(targetUser.id), 'member')

    const name = targetUser.username ? `@${targetUser.username}` : targetUser.first_name
    await ctx.reply(`${name} is no longer a moderator.`)
  })

  feature.command('mods', logHandle('cmd:mods'), async (ctx) => {
    const group = await prisma.managedGroup.findUnique({
      where: { chatId: BigInt(ctx.chat.id) },
    })
    if (!group)
      return

    const mods = await memberRepo.findModerators(group.id)

    if (mods.length === 0) {
      await ctx.reply('No moderators set for this group.')
      return
    }

    const lines = await Promise.all(
      mods.map(async (mod) => {
        try {
          const member = await ctx.api.getChatMember(ctx.chat.id, Number(mod.telegramId))
          const user = member.user
          return user.username ? `@${user.username}` : user.first_name
        }
        catch {
          return `User ${mod.telegramId}`
        }
      }),
    )

    await ctx.reply(`<b>Moderators:</b>\n${lines.join('\n')}`)
  })

  return feature
}
