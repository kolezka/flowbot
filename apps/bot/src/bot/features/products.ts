import type { Context } from '../context'
import { productsData, cartData } from '../callback-data/products'
import { menuData } from '../callback-data/menu'
import { logHandle } from '../helpers/logging'
import { prismaClient } from '../../database'
import {
  createCategoriesKeyboard,
  createProductsKeyboard,
  createProductKeyboard,
} from '../keyboards/products'
import {
  createCartKeyboard,
  createCartActionsKeyboard,
} from '../keyboards/cart'
import { InlineKeyboard } from 'grammy'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

// Helper function to update cart totals
async function updateCartTotals(cartId: string) {
  const cartItems = await prismaClient.cartItem.findMany({
    where: { cartId },
  })

  const totalItems = cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0)
  const totalAmount = cartItems.reduce(
    (sum: number, item: any) => sum + Number(item.productPrice) * item.quantity,
    0,
  )

  const cart = await prismaClient.cart.update({
    where: { id: cartId },
    data: { totalItems, totalAmount },
  })

  return { cart, totalItems, totalAmount }
}

const PRODUCTS_PER_PAGE = 6
const CATEGORIES_PER_PAGE = 6

// /products command - Show categories
feature.command('products', logHandle('command-products'), async (ctx) => {
  const categories = await prismaClient.category.findMany({
    where: { isActive: true },
    include: { products: { where: { isActive: true } } },
    orderBy: { order: 'asc' },
  })

  if (categories.length === 0) {
    const keyboard = InlineKeyboard.from([
      [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
    ])
    return ctx.reply(ctx.t('products-empty'), { reply_markup: keyboard })
  }

  const categoriesKeyboard = createCategoriesKeyboard(categories, 0)
  const backButton = InlineKeyboard.from([
    [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
  ])

  const mergedKeyboard = InlineKeyboard.from([
    ...categoriesKeyboard.inline_keyboard,
    ...backButton.inline_keyboard,
  ])

  return ctx.reply(ctx.t('products-select-category'), {
    reply_markup: mergedKeyboard,
  })
})

// /cart command - Show current cart contents
feature.command('cart', logHandle('command-cart'), async (ctx) => {
  const userId = ctx.session.userData.id

  const cart = await prismaClient.cart.findUnique({
    where: { userId },
    include: { items: true },
  })

  if (!cart || !cart.items || cart.items.length === 0) {
    const keyboard = InlineKeyboard.from([
      [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
    ])
    return ctx.reply(ctx.t('cart-empty'), { reply_markup: keyboard })
  }

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

  return ctx.reply(messageText, {
    reply_markup: mergedKeyboard,
  })
})

// Callback: List categories (with pagination)
feature.callbackQuery(
  productsData.filter({ action: 'list' }),
  logHandle('callback-products-list'),
  async (ctx) => {
    const { page } = productsData.unpack(ctx.callbackQuery.data)
    const currentPage = typeof page === 'number' ? page : 0

    const categories = await prismaClient.category.findMany({
      where: { isActive: true },
      include: { products: { where: { isActive: true } } },
      orderBy: { order: 'asc' },
    })

    if (categories.length === 0) {
      const keyboard = InlineKeyboard.from([
        [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
      ])
      return ctx.editMessageText(ctx.t('products-empty'), { reply_markup: keyboard })
    }

    const categoriesKeyboard = createCategoriesKeyboard(categories, currentPage)
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

// Callback: Show products in a category (with pagination)
feature.callbackQuery(
  productsData.filter({ action: 'category' }),
  logHandle('callback-products-category'),
  async (ctx) => {
    const { id, page } = productsData.unpack(ctx.callbackQuery.data)
    const currentPage = typeof page === 'number' ? page : 0

    const category = await prismaClient.category.findUnique({
      where: { id },
      include: { products: { where: { isActive: true } } },
    })

    if (!category || !category.products || category.products.length === 0) {
      const keyboard = InlineKeyboard.from([
        [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
      ])
      return ctx.editMessageText(ctx.t('products-empty'), { reply_markup: keyboard })
    }

    const messageText = `${category.name}\n\n${ctx.t('products-add-to-cart')}`

    const productsKeyboard = createProductsKeyboard(
      category.products as any,
      currentPage,
      id,
    )

    // Replace the back button in products keyboard to go to main menu
    const productsKeyboardRows = [...productsKeyboard.inline_keyboard]
    // Remove the last row (back button) and add new back button
    productsKeyboardRows.pop()
    productsKeyboardRows.push([
      { text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) },
    ])

    const mergedKeyboard = InlineKeyboard.from(productsKeyboardRows)

    return ctx.editMessageText(messageText, {
      reply_markup: mergedKeyboard,
    })
  },
)

// Callback: Show product details
feature.callbackQuery(
  productsData.filter({ action: 'product' }),
  logHandle('callback-products-product'),
  async (ctx) => {
    const { id } = productsData.unpack(ctx.callbackQuery.data)

    const product = await prismaClient.product.findUnique({
      where: { id },
      include: { category: true },
    })

    if (!product) {
      return ctx.answerCallbackQuery(ctx.t('products-empty'))
    }

    const messageText =
      `<b>${product.name}</b>\n\n` +
      `${product.description || ''}\n\n` +
      `💰 Price: $${product.price}\n` +
      `📦 In stock: ${product.stock}`

    const productKeyboard = createProductKeyboard(product as any, 1)

    // Replace the back button to go to main menu
    const productKeyboardRows = [...productKeyboard.inline_keyboard]
    // Remove the last row (back button) and add new back button
    productKeyboardRows.pop()
    productKeyboardRows.push([
      { text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) },
    ])

    const mergedKeyboard = InlineKeyboard.from(productKeyboardRows)

    return ctx.editMessageText(messageText, {
      reply_markup: mergedKeyboard,
      parse_mode: 'HTML',
    })
  },
)

// Callback: Add item to cart
feature.callbackQuery(
  cartData.filter({ action: 'add' }),
  logHandle('callback-cart-add'),
  async (ctx) => {
    const { id } = cartData.unpack(ctx.callbackQuery.data)
    const userId = ctx.session.userData.id

    const product = await prismaClient.product.findUnique({
      where: { id },
    })

    if (!product) {
      return ctx.answerCallbackQuery(ctx.t('products-empty'))
    }

    // Get or create cart
    let cart = await prismaClient.cart.findUnique({
      where: { userId },
    })

    if (!cart) {
      cart = await prismaClient.cart.create({
        data: {
          userId,
          totalItems: 0,
          totalAmount: 0,
        },
      })
    }

    // Check if item already exists in cart
    const existingItem = await prismaClient.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: id,
        },
      },
    })

    if (existingItem) {
      // Update quantity
      await prismaClient.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: { increment: 1 },
        },
      })
    } else {
      // Add new item
      await prismaClient.cartItem.create({
        data: {
          cartId: cart.id,
          productId: id,
          productName: product.name,
          productPrice: product.price,
          productImage: product.thumbnail,
          quantity: 1,
        },
      })
    }

    // Update cart totals using helper function
    await updateCartTotals(cart.id)

    return ctx.answerCallbackQuery(ctx.t('cart-item-added'))
  },
)

// Callback: Increment item quantity
feature.callbackQuery(
  cartData.filter({ action: 'increment' }),
  logHandle('callback-cart-increment'),
  async (ctx) => {
    const { id } = cartData.unpack(ctx.callbackQuery.data)
    const userId = ctx.session.userData.id

    // Get cart item
    const cartItem = await prismaClient.cartItem.findUnique({
      where: { id },
      include: { cart: true },
    })

    if (!cartItem) {
      return ctx.answerCallbackQuery('Item not found')
    }

    // Check product stock
    const product = await prismaClient.product.findUnique({
      where: { id: cartItem.productId },
    })

    if (!product || cartItem.quantity >= product.stock) {
      return ctx.answerCallbackQuery(ctx.t('cart-max-stock'))
    }

    // Increment quantity
    await prismaClient.cartItem.update({
      where: { id },
      data: { quantity: { increment: 1 } },
    })

    // Update cart totals
    await updateCartTotals(cartItem.cartId)

    // Refresh cart display
    const cart = await prismaClient.cart.findUnique({
      where: { userId },
      include: { items: true },
    })

    if (!cart || !cart.items || cart.items.length === 0) {
      const keyboard = InlineKeyboard.from([
        [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
      ])
      return ctx.editMessageText(ctx.t('cart-empty'), { reply_markup: keyboard })
    }

    let messageText = ctx.t('cart-title') + '\n\n'
    for (const item of cart.items) {
      messageText +=
        `${item.productName} x${item.quantity} - $${item.productPrice}\n`
    }
    messageText +=
      '\n' + ctx.t('cart-total', { amount: '$' + cart.totalAmount.toString() })

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

// Callback: Decrement item quantity
feature.callbackQuery(
  cartData.filter({ action: 'decrement' }),
  logHandle('callback-cart-decrement'),
  async (ctx) => {
    const { id } = cartData.unpack(ctx.callbackQuery.data)
    const userId = ctx.session.userData.id

    // Get cart item
    const cartItem = await prismaClient.cartItem.findUnique({
      where: { id },
      include: { cart: true },
    })

    if (!cartItem) {
      return ctx.answerCallbackQuery('Item not found')
    }

    // If quantity is 1, remove the item; otherwise decrement
    if (cartItem.quantity <= 1) {
      await prismaClient.cartItem.delete({ where: { id } })
    } else {
      await prismaClient.cartItem.update({
        where: { id },
        data: { quantity: { decrement: 1 } },
      })
    }

    // Update cart totals
    await updateCartTotals(cartItem.cartId)

    // Refresh cart display
    const cart = await prismaClient.cart.findUnique({
      where: { userId },
      include: { items: true },
    })

    if (!cart || !cart.items || cart.items.length === 0) {
      const keyboard = InlineKeyboard.from([
        [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
      ])
      return ctx.editMessageText(ctx.t('cart-empty'), { reply_markup: keyboard })
    }

    let messageText = ctx.t('cart-title') + '\n\n'
    for (const item of cart.items) {
      messageText +=
        `${item.productName} x${item.quantity} - $${item.productPrice}\n`
    }
    messageText +=
      '\n' + ctx.t('cart-total', { amount: '$' + cart.totalAmount.toString() })

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

// Callback: View cart
feature.callbackQuery(
  cartData.filter({ action: 'view' }),
  logHandle('callback-cart-view'),
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
      return ctx.editMessageText(ctx.t('cart-empty'), { reply_markup: keyboard })
    }

    let messageText = ctx.t('cart-title') + '\n\n'
    for (const item of cart.items) {
      messageText +=
        `${item.productName} x${item.quantity} - $${item.productPrice}\n`
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

// Callback: Remove item from cart
feature.callbackQuery(
  cartData.filter({ action: 'remove' }),
  logHandle('callback-cart-remove'),
  async (ctx) => {
    const { id } = cartData.unpack(ctx.callbackQuery.data)
    const userId = ctx.session.userData.id

    // Get the cart item first to retrieve cartId
    const cartItem = await prismaClient.cartItem.findUnique({
      where: { id },
    })

    if (!cartItem) {
      return ctx.answerCallbackQuery('Item not found')
    }

    // Delete the cart item
    await prismaClient.cartItem.delete({
      where: { id },
    })

    // Update cart totals using helper function
    await updateCartTotals(cartItem.cartId)

    // Refresh cart display
    const updatedCart = await prismaClient.cart.findUnique({
      where: { userId },
      include: { items: true },
    })

    if (!updatedCart || !updatedCart.items || updatedCart.items.length === 0) {
      const keyboard = InlineKeyboard.from([
        [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
      ])
      return ctx.editMessageText(ctx.t('cart-empty'), { reply_markup: keyboard })
    }

    let messageText = ctx.t('cart-title') + '\n\n'
    for (const item of updatedCart.items) {
      messageText +=
        `${item.productName} x${item.quantity} - $${item.productPrice}\n`
    }
    messageText +=
      '\n' + ctx.t('cart-total', { amount: '$' + updatedCart.totalAmount.toString() })

    const keyboard = createCartKeyboard(updatedCart)
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

// Callback: Clear cart
feature.callbackQuery(
  cartData.filter({ action: 'clear' }),
  logHandle('callback-cart-clear'),
  async (ctx) => {
    const userId = ctx.session.userData.id

    await prismaClient.cartItem.deleteMany({
      where: {
        cart: { userId },
      },
    })

    await prismaClient.cart.update({
      where: { userId },
      data: {
        totalItems: 0,
        totalAmount: 0,
      },
    })

    const keyboard = InlineKeyboard.from([
      [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
    ])
    return ctx.editMessageText(ctx.t('cart-cleared'), { reply_markup: keyboard })
  },
)

// Callback: Back to products (legacy - now goes to main menu)
feature.callbackQuery(
  cartData.filter({ action: 'back' }),
  logHandle('callback-cart-back'),
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
      return ctx.editMessageText(ctx.t('products-empty'), { reply_markup: keyboard })
    }

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

export { composer as productsFeature }
