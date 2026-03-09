import type { PrismaClient } from '@tg-allegro/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { ProductRepository } from '../../repositories/ProductRepository.js'
import { productCard } from '../helpers/deeplink.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

export function createPromoteFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const productRepo = new ProductRepository(prisma)
  const modLogRepo = new ModerationLogRepository(prisma)

  // /promote <slug> — send product card to group (admin only)
  feature.command('promote', requirePermission('admin', prisma), logHandle('cmd:promote'), async (ctx) => {
    const slug = ctx.match?.toString().trim()
    if (!slug) {
      await ctx.reply('Usage: /promote &lt;product-slug&gt;')
      return
    }

    const product = await productRepo.findBySlug(slug)
    if (!product) {
      await ctx.reply(`Product with slug "<b>${slug}</b>" not found.`)
      return
    }

    if (!product.isActive) {
      await ctx.reply('This product is not active.')
      return
    }

    const botUsername = ctx.config.salesBotUsername
    const card = productCard(product, botUsername)
    await ctx.reply(card)

    // Log promotion
    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (group) {
      await modLogRepo.create({
        groupId: group.id,
        action: 'promotion',
        actorId: BigInt(ctx.from!.id),
        details: { productId: product.id, slug: product.slug, name: product.name },
      })
    }
  })

  // /featured — list featured products (admin only)
  feature.command('featured', requirePermission('admin', prisma), logHandle('cmd:featured'), async (ctx) => {
    const products = await productRepo.findFeatured()
    if (products.length === 0) {
      await ctx.reply('No featured products found.')
      return
    }

    const botUsername = ctx.config.salesBotUsername
    const header = `<b>Featured Products (${products.length})</b>\n`
    const cards = products.map(p => productCard(p, botUsername))
    await ctx.reply(`${header}\n${cards.join('\n\n---\n\n')}`)
  })

  return feature
}
