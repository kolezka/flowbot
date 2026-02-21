import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductDto, ProductListResponseDto, CreateProductDto, UpdateProductDto } from './dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    search?: string,
    categoryId?: string,
    isActive?: boolean,
    inStock?: boolean,
  ): Promise<ProductListResponseDto> {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (inStock) {
      where.stock = { gt: 0 };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map(this.mapToDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<ProductDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.mapToDto(product);
  }

  async findBySlug(slug: string): Promise<ProductDto> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with slug ${slug} not found`);
    }

    return this.mapToDto(product);
  }

  async create(createProductDto: CreateProductDto): Promise<ProductDto> {
    const product = await this.prisma.product.create({
      data: createProductDto,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    this.logger.log(`Product created: ${product.id} - ${product.name}`);

    return this.mapToDto(product);
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<ProductDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: updateProductDto,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    this.logger.log(`Product updated: ${id}`);

    return this.mapToDto(updatedProduct);
  }

  async delete(id: string): Promise<ProductDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const deletedProduct = await this.prisma.product.delete({
      where: { id },
    });

    this.logger.log(`Product deleted: ${id}`);

    return this.mapToDto(deletedProduct);
  }

  private mapToDto(product: any): ProductDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      slug: product.slug,
      price: Number(product.price),
      compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : undefined,
      categoryId: product.categoryId,
      images: product.images,
      thumbnail: product.thumbnail,
      sku: product.sku,
      stock: product.stock,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
