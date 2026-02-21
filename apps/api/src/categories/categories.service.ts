import {
  Injectable,
  NotFoundException,
  Logger,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CategoryDto,
  CategoryTreeDto,
  CategoryListResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<CategoryListResponseDto> {
    const categories = await this.prisma.category.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    return {
      data: categories.map((cat) => this.mapToDto(cat)),
      total: categories.length,
    };
  }

  async findOne(id: string): Promise<CategoryDto> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return this.mapToDto(category);
  }

  async getTree(): Promise<CategoryTreeDto[]> {
    // Get all active categories with product counts
    const categories = await this.prisma.category.findMany({
      where: {
        isActive: true,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    // Build hierarchical tree
    const categoryMap = new Map<string, CategoryTreeDto>();

    // First pass: create all nodes
    categories.forEach((cat) => {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parentId: cat.parentId,
        order: cat.order,
        isActive: cat.isActive,
        productCount: cat._count.products,
        children: [],
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      });
    });

    // Second pass: build hierarchy
    const rootCategories: CategoryTreeDto[] = [];
    categoryMap.forEach((category) => {
      if (category.parentId && categoryMap.has(category.parentId)) {
        const parent = categoryMap.get(category.parentId)!;
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(category);

        // Add product count to parent (include all descendant products)
        parent.productCount += category.productCount;
      } else {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    // Check if slug already exists
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(`Category with slug '${dto.slug}' already exists`);
    }

    // If parentId is provided, verify parent exists
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException(`Parent category with ID ${dto.parentId} not found`);
      }
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        parentId: dto.parentId,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Category created: ${category.id} (${category.slug})`);

    return this.mapToDto(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Check if new slug conflicts with existing category
    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
      });

      if (existing) {
        throw new ConflictException(`Category with slug '${dto.slug}' already exists`);
      }
    }

    // If parentId is being changed, verify new parent exists and prevent circular reference
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      if (dto.parentId) {
        const parent = await this.prisma.category.findUnique({
          where: { id: dto.parentId },
        });

        if (!parent) {
          throw new NotFoundException(`Parent category with ID ${dto.parentId} not found`);
        }

        // Check for circular reference
        const isDescendant = await this.isDescendant(dto.parentId, id);
        if (isDescendant) {
          throw new BadRequestException(
            'Cannot set parent to a descendant category (circular reference)',
          );
        }
      }
    }

    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Category updated: ${updatedCategory.id}`);

    return this.mapToDto(updatedCategory);
  }

  async delete(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    if (category._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category._count.products} product(s). Please reassign or delete products first.`,
      );
    }

    if (category._count.children > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category._count.children} subcategory(ies). Please reassign or delete subcategories first.`,
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    this.logger.log(`Category deleted: ${id}`);
  }

  private async isDescendant(ancestorId: string, categoryId: string): Promise<boolean> {
    let currentId = categoryId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) {
        // Circular reference detected
        return true;
      }
      visited.add(currentId);

      if (currentId === ancestorId) {
        return true;
      }

      const category = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });

      currentId = category?.parentId || '';
    }

    return false;
  }

  private mapToDto(category: any): CategoryDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
      order: category.order,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
