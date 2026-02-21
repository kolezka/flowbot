import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartDto, CartItemDto, CreateCartItemDto, UpdateCartItemDto } from './dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private prisma: PrismaService) {}

  async getCartByUserId(userId: string): Promise<CartDto> {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          userId,
          totalItems: 0,
          totalAmount: 0,
        },
        include: { items: true },
      });
      this.logger.log(`Created new cart for user ${userId}`);
    }

    return this.mapToDto(cart);
  }

  async addItem(userId: string, dto: { productId: string; quantity: number }): Promise<CartDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${dto.productId} not found`);
    }

    if (!product.isActive) {
      throw new BadRequestException(`Product with ID ${dto.productId} is not available`);
    }

    if (product.stock < dto.quantity) {
      throw new BadRequestException(`Insufficient stock for product ${product.name}`);
    }

    const cart = await this.getCartByUserId(userId);

    const existingItem = cart.items.find((item) => item.productId === dto.productId);

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + dto.quantity,
        },
      });
      this.logger.log(
        `Updated item ${existingItem.id} quantity to ${existingItem.quantity + dto.quantity}`,
      );
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          quantity: dto.quantity,
          productName: product.name,
          productPrice: product.price,
          productImage: product.thumbnail || product.images[0] || null,
        },
      });
      this.logger.log(`Added product ${dto.productId} to cart ${cart.id}`);
    }

    return this.recalculateCart(cart.id);
  }

  async updateItemQuantity(
    userId: string,
    itemId: string,
    quantity: number,
  ): Promise<CartDto> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new NotFoundException(`Cart for user ${userId} not found`);
    }

    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item ${itemId} not found in user's cart`);
    }

    if (quantity > 0) {
      const product = await this.prisma.product.findUnique({
        where: { id: cartItem.productId },
      });

      if (product && product.stock < quantity) {
        throw new BadRequestException(`Insufficient stock for product ${product.name}`);
      }
    }

    if (quantity === 0) {
      await this.prisma.cartItem.delete({
        where: { id: itemId },
      });
      this.logger.log(`Removed item ${itemId} from cart ${cart.id}`);
    } else {
      await this.prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
      });
      this.logger.log(`Updated item ${itemId} quantity to ${quantity}`);
    }

    return this.recalculateCart(cart.id);
  }

  async removeItem(userId: string, itemId: string): Promise<CartDto> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new NotFoundException(`Cart for user ${userId} not found`);
    }

    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item ${itemId} not found in user's cart`);
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    this.logger.log(`Removed item ${itemId} from cart ${cart.id}`);

    return this.recalculateCart(cart.id);
  }

  async clearCart(userId: string): Promise<CartDto> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new NotFoundException(`Cart for user ${userId} not found`);
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    this.logger.log(`Cleared cart ${cart.id} for user ${userId}`);

    return this.recalculateCart(cart.id);
  }

  async getAllCarts(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [carts, total] = await Promise.all([
      this.prisma.cart.findMany({
        skip,
        take: limit,
        include: { items: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.cart.count(),
    ]);

    return {
      data: carts.map(this.mapToDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async recalculateCart(cartId: string): Promise<CartDto> {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
    });

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.productPrice) * item.quantity,
      0,
    );

    const cart = await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        totalItems,
        totalAmount,
      },
      include: { items: true },
    });

    return this.mapToDto(cart);
  }

  private mapToDto(cart: any): CartDto {
    return {
      id: cart.id,
      userId: cart.userId,
      items: cart.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productPrice: item.productPrice.toString(),
        productImage: item.productImage,
        quantity: item.quantity,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      totalItems: cart.totalItems,
      totalAmount: cart.totalAmount.toString(),
      updatedAt: cart.updatedAt,
    };
  }
}
