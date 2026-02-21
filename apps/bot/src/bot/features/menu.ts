import type { Context } from '../context'
import { menuData } from '../callback-data/menu'
import { changeLanguageData } from '../callback-data/change-language'
import { productsData, cartData } from '../callback-data/products'
import { logHandle } from '../helpers/logging'
import { createMainMenuKeyboard } from '../keyboards/menu'
import { createChangeLanguageKeyboard } from '../keyboards/change-language'
import { prismaClient } from '../../database'
import { InlineKeyboard } from 'grammy'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

// Main Menu Handler
feature.callbackQuery(
  menuData.filter({ section: 'menu' }),
  logHandle('callback-menu-main'),
  async (ctx) => {
    const messageText =
      `🏠 <b>Main Menu</b>\n\n` +
      `Welcome! Please select a section:`

    return ctx.editMessageText(messageText, {
      reply_markup: createMainMenuKeyboard(),
      parse_mode: 'HTML',
    })
  },
)

// Products Section Handler
feature.callbackQuery(
  menuData.filter({ section: 'products' }),
  logHandle('callback-menu-products'),
  async (ctx) => {
    const categories = await prismaClient.category.findMany({
      where: { isActive: true },
      include: { products: { where: { isActive: true } } },
      orderBy: { order: 'asc' },
    })

    if (categories.length === 0) {
      const keyboard = InlineKeyboard.from([
        [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
      ])
      return ctx.editMessageText(ctx.t('products-empty'), {
        reply_markup: keyboard,
      })
    }

    // Import here to avoid circular dependency
    const { createCategoriesKeyboard } = await import('../keyboards/products')

    // Add back button to categories keyboard
    const categoriesKeyboard = createCategoriesKeyboard(categories, 0)
    const backButton = InlineKeyboard.from([
      [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
    ])

    const mergedKeyboard = InlineKeyboard.from([
      ...categoriesKeyboard.inline_keyboard,
      ...backButton.inline_keyboard,
    ])

    return ctx.editMessageText(ctx.t('products-select-category'), {
      reply_markup: mergedKeyboard,
    })
  },
)

// Cart Section Handler
feature.callbackQuery(
  menuData.filter({ section: 'cart' }),
  logHandle('callback-menu-cart'),
  async (ctx) => {
    const userId = ctx.session.userData.id

    const cart = await prismaClient.cart.findUnique({
      where: { userId },
      include: { items: true },
    })

    if (!cart || !cart.items || cart.items.length === 0) {
      const keyboard = InlineKeyboard.from([
        [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
      ])
      return ctx.editMessageText(ctx.t('cart-empty'), {
        reply_markup: keyboard,
      })
    }

    // Import here to avoid circular dependency
    const { createCartKeyboard, createCartActionsKeyboard } = await import('../keyboards/cart')

    let messageText = ctx.t('cart-title') + '\n\n'
    for (const item of cart.items) {
      messageText += ctx.t('cart-item', {
        name: item.productName,
        quantity: item.quantity.toString(),
        price: '$' + item.productPrice.toString(),
      }) + '\n'
    }
    messageText += '\n' + ctx.t('cart-total', { amount: '$' + cart.totalAmount.toString() })

    const keyboard = createCartKeyboard(cart)
    const actionsKeyboard = createCartActionsKeyboard()
    const backButton = InlineKeyboard.from([
      [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
    ])

    const mergedKeyboard = InlineKeyboard.from([
      ...keyboard.inline_keyboard,
      ...actionsKeyboard.inline_keyboard,
      ...backButton.inline_keyboard,
    ])

    return ctx.editMessageText(messageText, {
      reply_markup: mergedKeyboard,
    })
  },
)

// Language Section Handler
feature.callbackQuery(
  menuData.filter({ section: 'language' }),
  logHandle('callback-menu-language'),
  async (ctx) => {
    const languageKeyboard = await createChangeLanguageKeyboard(ctx)
    const backButton = InlineKeyboard.from([
      [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
    ])

    const mergedKeyboard = InlineKeyboard.from([
      ...languageKeyboard.inline_keyboard,
      ...backButton.inline_keyboard,
    ])

    return ctx.editMessageText(ctx.t('language-select'), {
      reply_markup: mergedKeyboard,
    })
  },
)

export { composer as menuFeature }
