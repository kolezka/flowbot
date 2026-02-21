import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  DefaultValuePipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import {
  CartDto,
  CartListResponseDto,
  CreateCartItemDto,
  AddCartItemDto,
  UpdateCartItemDto,
} from './dto';

@ApiTags('cart')
@Controller('api/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get('user/:userId')
  @ApiOperation({ summary: "Get user's cart" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Returns the user's cart (creates one if it doesn't exist)",
    type: CartDto,
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'clx1234567890',
  })
  async getCartByUserId(@Param('userId') userId: string): Promise<CartDto> {
    return this.cartService.getCartByUserId(userId);
  }

  @Post('user/:userId/items')
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Item added to cart successfully',
    type: CartDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found or out of stock',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'clx1234567890',
  })
  async addItem(
    @Param('userId') userId: string,
    @Body() addCartItemDto: AddCartItemDto,
  ): Promise<CartDto> {
    return this.cartService.addItem(userId, addCartItemDto);
  }

  @Put('user/:userId/items/:itemId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cart item quantity updated successfully',
    type: CartDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cart or cart item not found',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'clx1234567890',
  })
  @ApiParam({
    name: 'itemId',
    description: 'Cart item ID',
    example: 'clx0987654321',
  })
  async updateItemQuantity(
    @Param('userId') userId: string,
    @Param('itemId') itemId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ): Promise<CartDto> {
    return this.cartService.updateItemQuantity(userId, itemId, updateCartItemDto.quantity);
  }

  @Delete('user/:userId/items/:itemId')
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Item removed from cart successfully',
    type: CartDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cart or cart item not found',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'clx1234567890',
  })
  @ApiParam({
    name: 'itemId',
    description: 'Cart item ID',
    example: 'clx0987654321',
  })
  async removeItem(
    @Param('userId') userId: string,
    @Param('itemId') itemId: string,
  ): Promise<CartDto> {
    return this.cartService.removeItem(userId, itemId);
  }

  @Delete('user/:userId/clear')
  @ApiOperation({ summary: 'Clear entire cart' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cart cleared successfully',
    type: CartDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cart not found',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'clx1234567890',
  })
  async clearCart(@Param('userId') userId: string): Promise<CartDto> {
    return this.cartService.clearCart(userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all carts (paginated)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated list of all carts',
    type: CartListResponseDto,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  async getAllCarts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<CartListResponseDto> {
    return this.cartService.getAllCarts(page, limit);
  }
}
