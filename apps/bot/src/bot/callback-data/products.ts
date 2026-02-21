import { createCallbackData } from 'callback-data'

export const productsData = createCallbackData('products', {
  action: String,
  id: String,
  page: Number,
})

export const cartData = createCallbackData('cart', {
  action: String,
  id: String,
})
