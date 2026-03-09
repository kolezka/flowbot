import type { Category, PrismaClient, Product } from '@tg-allegro/db'

export type ProductWithCategory = Product & { category: Category }

export class ProductRepository {
  constructor(private prisma: PrismaClient) {}

  async findBySlug(slug: string): Promise<ProductWithCategory | null> {
    return this.prisma.product.findUnique({
      where: { slug },
      include: { category: true },
    })
  }

  async findFeatured(limit = 10): Promise<ProductWithCategory[]> {
    return this.prisma.product.findMany({
      where: { isFeatured: true, isActive: true },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async findByCategory(categoryId: string, limit = 20): Promise<ProductWithCategory[]> {
    return this.prisma.product.findMany({
      where: { categoryId, isActive: true },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
