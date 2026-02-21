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
import { ProductsService } from './products.service';
import {
  ProductDto,
  ProductListResponseDto,
  CreateProductDto,
  UpdateProductDto,
} from './dto';

@ApiTags('products')
@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of products' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated list of products with optional filtering',
    type: ProductListResponseDto,
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
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by name or description (partial match, case-insensitive)',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'inStock',
    required: false,
    type: Boolean,
    description: 'Only show products with stock > 0',
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('isActive') isActive?: string,
    @Query('inStock') inStock?: string,
  ): Promise<ProductListResponseDto> {
    const parsedIsActive = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    const parsedInStock = inStock === 'true';
    return this.productsService.findAll(page, limit, search, categoryId, parsedIsActive, parsedInStock);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns a single product by ID',
    type: ProductDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: 'clx1234567890',
  })
  async findOne(@Param('id') id: string): Promise<ProductDto> {
    return this.productsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product created successfully',
    type: ProductDto,
  })
  async create(@Body() createProductDto: CreateProductDto): Promise<ProductDto> {
    return this.productsService.create(createProductDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product updated successfully',
    type: ProductDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: 'clx1234567890',
  })
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductDto> {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product deleted successfully',
    type: ProductDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: 'clx1234567890',
  })
  async delete(@Param('id') id: string): Promise<ProductDto> {
    return this.productsService.delete(id);
  }
}
