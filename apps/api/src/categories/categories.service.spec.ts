import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
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

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: Record<string, any>;

  const mockCategory = {
    id: 'cat-1',
    name: 'Electronics',
    slug: 'electronics',
    parentId: null,
    order: 0,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
  };

  const mockChildCategory = {
    id: 'cat-2',
    name: 'Phones',
    slug: 'phones',
    parentId: 'cat-1',
    order: 1,
    isActive: true,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-03-01'),
  };

  beforeEach(async () => {
    prisma = {
      category: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('findAll', () => {
    it('should return active categories sorted by order', async () => {
      prisma.category.findMany.mockResolvedValue([mockCategory, mockChildCategory]);

      const result = await service.findAll();

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });
    });
  });

  describe('findOne', () => {
    it('should return a category by ID', async () => {
      prisma.category.findUnique.mockResolvedValue(mockCategory);

      const result = await service.findOne('cat-1');

      expect(result.id).toBe('cat-1');
      expect(result.name).toBe('Electronics');
    });

    it('should throw NotFoundException for non-existent category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTree', () => {
    it('should build hierarchical tree from flat list', async () => {
      const parentWithCount = {
        ...mockCategory,
        _count: { products: 5 },
      };
      const childWithCount = {
        ...mockChildCategory,
        _count: { products: 3 },
      };

      prisma.category.findMany.mockResolvedValue([parentWithCount, childWithCount]);

      const result = await service.getTree();

      expect(result).toHaveLength(1); // Only root categories
      expect(result[0].id).toBe('cat-1');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].id).toBe('cat-2');
    });

    it('should aggregate product counts to parents', async () => {
      const parentWithCount = {
        ...mockCategory,
        _count: { products: 5 },
      };
      const childWithCount = {
        ...mockChildCategory,
        _count: { products: 3 },
      };

      prisma.category.findMany.mockResolvedValue([parentWithCount, childWithCount]);

      const result = await service.getTree();

      // Parent should have 5 (own) + 3 (child) = 8
      expect(result[0].productCount).toBe(8);
      expect(result[0].children[0].productCount).toBe(3);
    });

    it('should handle categories without parents as root', async () => {
      const rootA = { ...mockCategory, id: 'cat-a', _count: { products: 2 } };
      const rootB = { ...mockCategory, id: 'cat-b', name: 'Clothing', slug: 'clothing', _count: { products: 1 } };

      prisma.category.findMany.mockResolvedValue([rootA, rootB]);

      const result = await service.getTree();

      expect(result).toHaveLength(2);
    });
  });

  describe('create', () => {
    it('should create a category', async () => {
      prisma.category.findUnique.mockResolvedValue(null); // slug check
      prisma.category.create.mockResolvedValue(mockCategory);

      const result = await service.create({
        name: 'Electronics',
        slug: 'electronics',
      });

      expect(result.name).toBe('Electronics');
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Electronics',
          slug: 'electronics',
          order: 0,
          isActive: true,
        }),
      });
    });

    it('should throw ConflictException for duplicate slug', async () => {
      prisma.category.findUnique.mockResolvedValue(mockCategory); // slug exists

      await expect(
        service.create({ name: 'Another', slug: 'electronics' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should validate parent exists when parentId provided', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce(null)  // slug check - no conflict
        .mockResolvedValueOnce(null); // parent check - not found

      await expect(
        service.create({ name: 'Phones', slug: 'phones', parentId: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create with valid parent', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce(null)        // slug check
        .mockResolvedValueOnce(mockCategory); // parent check
      prisma.category.create.mockResolvedValue(mockChildCategory);

      const result = await service.create({
        name: 'Phones',
        slug: 'phones',
        parentId: 'cat-1',
      });

      expect(result.parentId).toBe('cat-1');
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      prisma.category.findUnique.mockResolvedValue(mockCategory);
      const updated = { ...mockCategory, name: 'Updated Electronics' };
      prisma.category.update.mockResolvedValue(updated);

      const result = await service.update('cat-1', { name: 'Updated Electronics' });

      expect(result.name).toBe('Updated Electronics');
    });

    it('should throw NotFoundException for non-existent category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle slug conflict on update', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce(mockCategory)          // find category
        .mockResolvedValueOnce(mockChildCategory);     // slug conflict

      await expect(
        service.update('cat-1', { slug: 'phones' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent self-parent', async () => {
      prisma.category.findUnique.mockResolvedValue(mockCategory);

      await expect(
        service.update('cat-1', { parentId: 'cat-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent circular reference', async () => {
      // cat-1 -> cat-2 (child). Trying to set cat-1's parent to cat-2 would be circular.
      prisma.category.findUnique
        .mockResolvedValueOnce(mockCategory)         // find cat-1
        .mockResolvedValueOnce(mockChildCategory)    // find parent cat-2 (exists)
        // isDescendant traversal: check cat-1, its parentId is null
        .mockResolvedValueOnce({ parentId: 'cat-1' }); // cat-2's parent is cat-1

      await expect(
        service.update('cat-1', { parentId: 'cat-2' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should delete an empty category', async () => {
      const categoryWithCounts = {
        ...mockCategory,
        _count: { products: 0, children: 0 },
      };
      prisma.category.findUnique.mockResolvedValue(categoryWithCounts);
      prisma.category.delete.mockResolvedValue(mockCategory);

      await service.delete('cat-1');

      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      });
    });

    it('should throw NotFoundException for non-existent category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when category has products', async () => {
      const categoryWithProducts = {
        ...mockCategory,
        _count: { products: 3, children: 0 },
      };
      prisma.category.findUnique.mockResolvedValue(categoryWithProducts);

      await expect(service.delete('cat-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when category has children', async () => {
      const categoryWithChildren = {
        ...mockCategory,
        _count: { products: 0, children: 2 },
      };
      prisma.category.findUnique.mockResolvedValue(categoryWithChildren);

      await expect(service.delete('cat-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
