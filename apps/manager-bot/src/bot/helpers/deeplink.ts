import type { Product } from '@tg-allegro/db'

export function productDeeplink(botUsername: string, productId: string): string {
  return `https://t.me/${botUsername}?start=product_${productId}`
}

export function productCard(product: Product, botUsername?: string): string {
  const lines: string[] = []

  lines.push(`<b>${escapeHtml(product.name)}</b>`)
  lines.push(`Price: <b>${Number(product.price).toFixed(2)} PLN</b>`)

  if (product.description) {
    const preview = product.description.length > 100
      ? `${product.description.slice(0, 100)}...`
      : product.description
    lines.push(`\n${escapeHtml(preview)}`)
  }

  if (botUsername) {
    const link = productDeeplink(botUsername, product.id)
    lines.push(`\n<a href="${link}">Buy now</a>`)
  }

  return lines.join('\n')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
