import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import {
  CategoryDto,
  CategoryListResponseDto,
  CategoryTreeDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto';

@ApiTags('categories')
@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active categories' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns list of all active categories',
    type: CategoryListResponseDto,
  })
  async findAll(): Promise<CategoryListResponseDto> {
    return this.categoriesService.findAll();
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get categories as hierarchical tree' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns categories in hierarchical structure with product counts',
    type: [CategoryTreeDto],
  })
  async getTree(): Promise<CategoryTreeDto[]> {
    return this.categoriesService.getTree();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns a single category by ID',
    type: CategoryDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Category ID',
    example: 'clx1234567890',
  })
  async findOne(@Param('id') id: string): Promise<CategoryDto> {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Category created successfully',
    type: CategoryDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Category with this slug already exists',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Parent category not found',
  })
  async create(@Body() createCategoryDto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categoriesService.create(createCategoryDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category updated successfully',
    type: CategoryDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Category with this slug already exists',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Circular reference detected or cannot be own parent',
  })
  @ApiParam({
    name: 'id',
    description: 'Category ID',
    example: 'clx1234567890',
  })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Category deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete category with products or subcategories',
  })
  @ApiParam({
    name: 'id',
    description: 'Category ID',
    example: 'clx1234567890',
  })
  async delete(@Param('id') id: string): Promise<void> {
    return this.categoriesService.delete(id);
  }
}
