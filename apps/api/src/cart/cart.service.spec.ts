import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
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

describe('CartService', () => {
  let service: CartService;
  let prisma: Record<string, any>;

  const mockProduct = {
    id: 'prod-1',
    name: 'Test Product',
    price: 29.99,
    stock: 50,
    isActive: true,
    thumbnail: 'thumb.jpg',
    images: ['img1.jpg'],
  };

  const mockCartItem = {
    id: 'item-1',
    cartId: 'cart-1',
    productId: 'prod-1',
    productName: 'Test Product',
    productPrice: 29.99,
    productImage: 'thumb.jpg',
    quantity: 2,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
  };

  const mockCart = {
    id: 'cart-1',
    userId: 'user-1',
    totalItems: 2,
    totalAmount: 59.98,
    items: [mockCartItem],
    updatedAt: new Date('2026-03-01'),
  };

  beforeEach(async () => {
    prisma = {
      cart: createMockModel(),
      cartItem: createMockModel(),
      product: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  describe('getCartByUserId', () => {
    it('should return existing cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(mockCart);

      const result = await service.getCartByUserId('user-1');

      expect(result.id).toBe('cart-1');
      expect(result.userId).toBe('user-1');
      expect(result.items).toHaveLength(1);
      expect(prisma.cart.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { items: true },
      });
    });

    it('should create a new cart if none exists', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);
      const newCart = {
        id: 'cart-new',
        userId: 'user-1',
        totalItems: 0,
        totalAmount: 0,
        items: [],
        updatedAt: new Date(),
      };
      prisma.cart.create.mockResolvedValue(newCart);

      const result = await service.getCartByUserId('user-1');

      expect(result.id).toBe('cart-new');
      expect(result.totalItems).toBe(0);
      expect(prisma.cart.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          totalItems: 0,
          totalAmount: 0,
        },
        include: { items: true },
      });
    });
  });

  describe('addItem', () => {
    it('should add a new item to the cart', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      // getCartByUserId will call findUnique
      prisma.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [], // empty cart
      });
      prisma.cartItem.create.mockResolvedValue(mockCartItem);
      // recalculateCart calls
      prisma.cartItem.findMany.mockResolvedValue([mockCartItem]);
      prisma.cart.update.mockResolvedValue(mockCart);

      const result = await service.addItem('user-1', {
        productId: 'prod-1',
        quantity: 2,
      });

      expect(prisma.cartItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          quantity: 2,
          productName: 'Test Product',
        }),
      });
      expect(result.id).toBe('cart-1');
    });

    it('should increment quantity for existing item', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      // Cart already has the item
      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.update.mockResolvedValue({ ...mockCartItem, quantity: 4 });
      // recalculateCart
      prisma.cartItem.findMany.mockResolvedValue([{ ...mockCartItem, quantity: 4 }]);
      prisma.cart.update.mockResolvedValue({
        ...mockCart,
        items: [{ ...mockCartItem, quantity: 4 }],
        totalItems: 4,
        totalAmount: 119.96,
      });

      const result = await service.addItem('user-1', {
        productId: 'prod-1',
        quantity: 2,
      });

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { quantity: 4 }, // 2 existing + 2 new
      });
    });

    it('should throw for inactive product', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      await expect(
        service.addItem('user-1', { productId: 'prod-1', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for insufficient stock', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        stock: 1,
      });

      await expect(
        service.addItem('user-1', { productId: 'prod-1', quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for non-existent product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.addItem('user-1', { productId: 'nonexistent', quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateItemQuantity', () => {
    it('should update quantity of an item', async () => {
      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.findFirst.mockResolvedValue(mockCartItem);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.cartItem.update.mockResolvedValue({ ...mockCartItem, quantity: 5 });
      // recalculateCart
      prisma.cartItem.findMany.mockResolvedValue([{ ...mockCartItem, quantity: 5 }]);
      prisma.cart.update.mockResolvedValue({
        ...mockCart,
        items: [{ ...mockCartItem, quantity: 5 }],
      });

      const result = await service.updateItemQuantity('user-1', 'item-1', 5);

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { quantity: 5 },
      });
    });

    it('should remove item when quantity is 0', async () => {
      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.findFirst.mockResolvedValue(mockCartItem);
      prisma.cartItem.delete.mockResolvedValue(mockCartItem);
      // recalculateCart
      prisma.cartItem.findMany.mockResolvedValue([]);
      prisma.cart.update.mockResolvedValue({
        ...mockCart,
        items: [],
        totalItems: 0,
        totalAmount: 0,
      });

      await service.updateItemQuantity('user-1', 'item-1', 0);

      expect(prisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });

    it('should throw for non-existent cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      await expect(
        service.updateItemQuantity('user-1', 'item-1', 5),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw for non-existent cart item', async () => {
      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateItemQuantity('user-1', 'nonexistent', 5),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeItem', () => {
    it('should remove an item from the cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.findFirst.mockResolvedValue(mockCartItem);
      prisma.cartItem.delete.mockResolvedValue(mockCartItem);
      // recalculateCart
      prisma.cartItem.findMany.mockResolvedValue([]);
      prisma.cart.update.mockResolvedValue({
        ...mockCart,
        items: [],
        totalItems: 0,
        totalAmount: 0,
      });

      await service.removeItem('user-1', 'item-1');

      expect(prisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });

    it('should throw for non-existent cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      await expect(
        service.removeItem('user-1', 'item-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw for non-existent item', async () => {
      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.findFirst.mockResolvedValue(null);

      await expect(
        service.removeItem('user-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearCart', () => {
    it('should clear all items from the cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
      // recalculateCart
      prisma.cartItem.findMany.mockResolvedValue([]);
      prisma.cart.update.mockResolvedValue({
        ...mockCart,
        items: [],
        totalItems: 0,
        totalAmount: 0,
      });

      const result = await service.clearCart('user-1');

      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1' },
      });
      expect(result.totalItems).toBe(0);
    });

    it('should throw for non-existent cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      await expect(service.clearCart('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('recalculateCart (via clearCart)', () => {
    it('should correctly compute totalItems and totalAmount', async () => {
      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });

      const items = [
        { ...mockCartItem, quantity: 3, productPrice: 10.00 },
        { ...mockCartItem, id: 'item-2', quantity: 2, productPrice: 20.00 },
      ];
      prisma.cartItem.findMany.mockResolvedValue(items);
      prisma.cart.update.mockResolvedValue({
        ...mockCart,
        items,
        totalItems: 5,
        totalAmount: 70.00,
      });

      const result = await service.clearCart('user-1');

      expect(prisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
        data: {
          totalItems: 5,   // 3 + 2
          totalAmount: 70,  // 3*10 + 2*20
        },
        include: { items: true },
      });
    });
  });
});
