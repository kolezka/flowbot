import { ApiProperty } from '@nestjs/swagger';

export class CategoryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ required: false })
  parentId?: string;

  @ApiProperty()
  order!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CategoryTreeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ required: false })
  parentId?: string;

  @ApiProperty()
  order!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  productCount!: number;

  @ApiProperty({ type: () => [CategoryTreeDto], required: false })
  children?: CategoryTreeDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CategoryListResponseDto {
  @ApiProperty()
  data!: CategoryDto[];

  @ApiProperty()
  total!: number;
}

export class CreateCategoryDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ required: false })
  parentId?: string;

  @ApiProperty({ required: false, default: 0 })
  order?: number;

  @ApiProperty({ required: false, default: true })
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  slug?: string;

  @ApiProperty({ required: false })
  parentId?: string;

  @ApiProperty({ required: false })
  order?: number;

  @ApiProperty({ required: false })
  isActive?: boolean;
}
