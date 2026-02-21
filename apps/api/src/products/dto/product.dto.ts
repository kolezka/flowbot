import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsNotEmpty, Min, IsDateString } from 'class-validator';

export class ProductDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  price!: number;

  @ApiProperty({ required: false })
  compareAtPrice?: number;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  images!: string[];

  @ApiProperty({ required: false })
  thumbnail?: string;

  @ApiProperty({ required: false })
  sku?: string;

  @ApiProperty()
  stock!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  isFeatured!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ProductListResponseDto {
  @ApiProperty()
  data!: ProductDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  compareAtPrice?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  images!: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  thumbnail?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  stock!: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}

export class UpdateProductDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  compareAtPrice?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  thumbnail?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}
