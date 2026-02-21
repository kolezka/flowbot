import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, IsBoolean, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @ApiProperty({
    description: 'Page number',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    default: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Search by username (case-insensitive, partial match)',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: 'Filter by banned status', required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBanned?: boolean;
}
