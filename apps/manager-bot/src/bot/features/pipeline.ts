import type { PrismaClient } from '@flowbot/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { GroupConfigRepository } from '../../repositories/GroupConfigRepository.js'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

export function createPipelineFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const configRepo = new GroupConfigRepository(prisma)
  const modLogRepo = new ModerationLogRepository(prisma)

  feature.command('pipeline', requirePermission('admin', prisma), logHandle('cmd:pipeline'), async (ctx) => {
    const args = ctx.match?.toString().trim().split(/\s+/) ?? []
    const subcommand = args[0]?.toLowerCase()

    const config = ctx.session.groupConfig
    if (!config) {
      await ctx.reply('No configuration found for this group.')
      return
    }

    // /pipeline on
    if (subcommand === 'on') {
      await configRepo.updateConfig(config.groupId, { pipelineEnabled: true })
      ctx.session.groupConfig = { ...config, pipelineEnabled: true }

      const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
      if (group) {
        await modLogRepo.create({
          groupId: group.id,
          action: 'config_change',
          actorId: BigInt(ctx.from!.id),
          details: { key: 'pipelineEnabled', newValue: 'true' },
        })
      }

      await ctx.reply('✅ Member→Customer pipeline enabled. New members will trigger welcome DMs.')
      return
    }

    // /pipeline off
    if (subcommand === 'off') {
      await configRepo.updateConfig(config.groupId, { pipelineEnabled: false })
      ctx.session.groupConfig = { ...config, pipelineEnabled: false }

      const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
      if (group) {
        await modLogRepo.create({
          groupId: group.id,
          action: 'config_change',
          actorId: BigInt(ctx.from!.id),
          details: { key: 'pipelineEnabled', newValue: 'false' },
        })
      }

      await ctx.reply('✅ Member→Customer pipeline disabled.')
      return
    }

    // /pipeline template <text>
    if (subcommand === 'template') {
      const templateText = args.slice(1).join(' ')
      if (!templateText) {
        const current = config.pipelineDmTemplate || '(not set)'
        await ctx.reply(
          `<b>Pipeline DM Template</b>\n\n`
          + `Current: ${current}\n\n`
          + `Usage: /pipeline template &lt;text&gt;\n`
          + `Set the message sent as a DM to new members.`,
        )
        return
      }

      await configRepo.updateConfig(config.groupId, { pipelineDmTemplate: templateText })
      ctx.session.groupConfig = { ...config, pipelineDmTemplate: templateText }

      await ctx.reply(`✅ Pipeline DM template updated.`)
      return
    }

    // /pipeline deeplink <url>
    if (subcommand === 'deeplink') {
      const deeplinkValue = args.slice(1).join(' ')
      if (!deeplinkValue) {
        const current = config.pipelineDeeplink || '(not set)'
        await ctx.reply(
          `<b>Pipeline Deeplink</b>\n\n`
          + `Current: ${current}\n\n`
          + `Usage: /pipeline deeplink &lt;url&gt;`,
        )
        return
      }

      await configRepo.updateConfig(config.groupId, { pipelineDeeplink: deeplinkValue })
      ctx.session.groupConfig = { ...config, pipelineDeeplink: deeplinkValue }

      await ctx.reply(`✅ Pipeline deeplink updated.`)
      return
    }

    // /pipeline test — preview what would be logged/sent
    if (subcommand === 'test') {
      const status = config.pipelineEnabled ? '✅ Enabled' : '❌ Disabled'
      const template = config.pipelineDmTemplate || '(not set)'
      const deeplink = config.pipelineDeeplink || '(not set)'

      await ctx.reply(
        `<b>Pipeline Test</b>\n\n`
        + `Status: ${status}\n`
        + `DM Template: ${template}\n`
        + `Deeplink: ${deeplink}\n\n`
        + `When a new member joins, a <code>pipeline_trigger</code> log entry will be created `
        + `for Trigger.dev to process.`,
      )
      return
    }

    // /pipeline (no args) — show status
    const status = config.pipelineEnabled ? '✅ Enabled' : '❌ Disabled'
    const template = config.pipelineDmTemplate || '(not set)'
    const deeplink = config.pipelineDeeplink || '(not set)'

    await ctx.reply(
      `<b>Member→Customer Pipeline</b>\n\n`
      + `Status: ${status}\n`
      + `DM Template: ${template}\n`
      + `Deeplink: ${deeplink}\n\n`
      + `Commands:\n`
      + `/pipeline on|off — toggle pipeline\n`
      + `/pipeline template &lt;text&gt; — set DM text\n`
      + `/pipeline deeplink &lt;url&gt; — set deeplink\n`
      + `/pipeline test — preview config`,
    )
  })

  return feature
}
