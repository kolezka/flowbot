import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CartItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  productPrice!: string;

  @ApiProperty({ required: false })
  productImage?: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CartDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: [CartItemDto] })
  items!: CartItemDto[];

  @ApiProperty()
  totalItems!: number;

  @ApiProperty()
  totalAmount!: string;

  @ApiProperty()
  updatedAt!: Date;
}

export class CreateCartItemDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}

export class AddCartItemDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}

export class UpdateCartItemDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  quantity!: number;
}

export class CartListResponseDto {
  @ApiProperty()
  data!: CartDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}
