import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CommunityDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  platform: string;

  @ApiProperty()
  platformCommunityId: string;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  type?: string;

  @ApiProperty()
  memberCount: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false })
  metadata?: Record<string, unknown>;

  @ApiProperty({ required: false })
  botInstanceId?: string;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty({ required: false })
  leftAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CommunityListResponseDto {
  @ApiProperty({ type: [CommunityDto] })
  data: CommunityDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class CreateCommunityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  platform: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  platformCommunityId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  botInstanceId?: string;
}

export class UpdateCommunityDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, description: 'Bot instance ID to link' })
  @IsOptional()
  @IsString()
  botInstanceId?: string;
}
