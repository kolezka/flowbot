import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

function createMockModel() {
  return {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  };
}

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: Record<string, any>;

  const mockCategory = {
    id: 'cat-1',
    name: 'Electronics',
    slug: 'electronics',
  };

  const mockProduct = {
    id: 'prod-1',
    name: 'Test Product',
    description: 'A great product',
    slug: 'test-product',
    price: 29.99,
    compareAtPrice: 39.99,
    categoryId: 'cat-1',
    images: ['img1.jpg', 'img2.jpg'],
    thumbnail: 'thumb.jpg',
    sku: 'SKU-001',
    stock: 50,
    isActive: true,
    isFeatured: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
    category: mockCategory,
  };

  beforeEach(async () => {
    prisma = {
      product: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.data[0].name).toBe('Test Product');
      expect(result.data[0].price).toBe(29.99);
    });

    it('should search by name or description', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll(1, 20, 'great');

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'great', mode: 'insensitive' } },
              { description: { contains: 'great', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should filter by categoryId', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll(1, 20, undefined, 'cat-1');

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'cat-1' }),
        }),
      );
    });

    it('should filter by isActive', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll(1, 20, undefined, undefined, true);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('should filter by inStock', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll(1, 20, undefined, undefined, undefined, true);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ stock: { gt: 0 } }),
        }),
      );
    });

    it('should calculate pagination correctly for page 2', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(30);

      const result = await service.findAll(2, 10);

      expect(result.totalPages).toBe(3);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a product by ID', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne('prod-1');

      expect(result.id).toBe('prod-1');
      expect(result.name).toBe('Test Product');
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      });
    });

    it('should throw NotFoundException for non-existent product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findBySlug', () => {
    it('should return a product by slug', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findBySlug('test-product');

      expect(result.slug).toBe('test-product');
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-product' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      });
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a product with category relation', async () => {
      const createDto = {
        name: 'New Product',
        description: 'A new product',
        slug: 'new-product',
        price: 19.99,
        categoryId: 'cat-1',
        stock: 10,
        isActive: true,
      };

      const createdProduct = {
        ...mockProduct,
        ...createDto,
        id: 'prod-2',
        images: [],
        thumbnail: null,
        sku: null,
        isFeatured: false,
        category: mockCategory,
      };

      prisma.product.create.mockResolvedValue(createdProduct);

      const result = await service.create(createDto as any);

      expect(result.name).toBe('New Product');
      expect(prisma.product.create).toHaveBeenCalledWith({
        data: createDto,
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      });
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      const updatedProduct = { ...mockProduct, name: 'Updated Product' };
      prisma.product.update.mockResolvedValue(updatedProduct);

      const result = await service.update('prod-1', { name: 'Updated Product' } as any);

      expect(result.name).toBe('Updated Product');
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { name: 'Updated Product' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      });
    });

    it('should throw NotFoundException for non-existent product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Updated' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a product', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.product.delete.mockResolvedValue(mockProduct);

      const result = await service.delete('prod-1');

      expect(result.id).toBe('prod-1');
      expect(prisma.product.delete).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
      });
    });

    it('should throw NotFoundException for non-existent product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
