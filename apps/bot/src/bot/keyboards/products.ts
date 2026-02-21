import type { Context } from '../context'
import { productsData, cartData } from '../callback-data/products'
import { chunk } from '../helpers/keyboard'
import { i18n } from '../i18n'
import { InlineKeyboard } from 'grammy'
import type { Category, Product } from '@tg-allegro/db'

interface CategoryWithProducts extends Category {
  products?: Product[]
}

export function createCategoriesKeyboard(categories: CategoryWithProducts[], page: number) {
  const itemsPerPage = 6
  const totalPages = Math.ceil(categories.length / itemsPerPage)
  const paginatedCategories = categories.slice(page * itemsPerPage, (page + 1) * itemsPerPage)

  const keyboard = chunk(
    paginatedCategories.map(category => ({
      text: category.name,
      callback_data: productsData.pack({
        action: 'category',
        id: category.id,
        page: 0,
      }),
    })),
    2,
  )

  // Add pagination buttons
  const paginationRow = []
  if (page > 0) {
    paginationRow.push({
      text: '⬅️',
      callback_data: productsData.pack({
        action: 'list',
        id: '',
        page: page - 1,
      }),
    })
  }
  paginationRow.push({
    text: `${page + 1}/${totalPages || 1}`,
    callback_data: 'noop',
  })
  if (page < totalPages - 1) {
    paginationRow.push({
      text: '➡️',
      callback_data: productsData.pack({
        action: 'list',
        id: '',
        page: page + 1,
      }),
    })
  }

  if (paginationRow.length > 1) {
    keyboard.push(paginationRow)
  }

  return InlineKeyboard.from(keyboard)
}

export function createProductsKeyboard(products: Product[], page: number, categoryId: string) {
  const itemsPerPage = 6
  const totalPages = Math.ceil(products.length / itemsPerPage)
  const paginatedProducts = products.slice(page * itemsPerPage, (page + 1) * itemsPerPage)

  const keyboard = chunk(
    paginatedProducts.map(product => ({
      text: product.name,
      callback_data: productsData.pack({
        action: 'product',
        id: product.id,
        page: 0,
      }),
    })),
    2,
  )

  // Add back button
  keyboard.push([{
    text: '🔙',
    callback_data: productsData.pack({
      action: 'list',
      id: '',
      page: 0,
    }),
  }])

  // Add pagination buttons
  const paginationRow = []
  if (page > 0) {
    paginationRow.push({
      text: '⬅️',
      callback_data: productsData.pack({
        action: 'category',
        id: categoryId,
        page: page - 1,
      }),
    })
  }
  paginationRow.push({
    text: `${page + 1}/${totalPages || 1}`,
    callback_data: 'noop',
  })
  if (page < totalPages - 1) {
    paginationRow.push({
      text: '➡️',
      callback_data: productsData.pack({
        action: 'category',
        id: categoryId,
        page: page + 1,
      }),
    })
  }

  if (paginationRow.length > 1) {
    keyboard.push(paginationRow)
  }

  return InlineKeyboard.from(keyboard)
}

export function createProductKeyboard(product: Product, quantity: number = 1) {
  const keyboard = []

  // Add to cart button
  keyboard.push([{
    text: '🛒 Add to Cart',
    callback_data: cartData.pack({
      action: 'add',
      id: product.id,
    }),
  }])

  // Back to categories button
  keyboard.push([{
    text: '🔙 Back to Categories',
    callback_data: productsData.pack({
      action: 'list',
      id: '',
      page: 0,
    }),
  }])

  return InlineKeyboard.from(keyboard)
}
