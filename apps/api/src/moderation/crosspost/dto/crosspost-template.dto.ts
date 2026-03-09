import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsArray } from 'class-validator';

export class CrossPostTemplateDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  messageText: string;

  @ApiProperty({ type: [String] })
  targetChatIds: string[];

  @ApiProperty({ type: [String] })
  targetGroupNames: string[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CrossPostTemplateListResponseDto {
  @ApiProperty({ type: [CrossPostTemplateDto] })
  data: CrossPostTemplateDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class CreateCrossPostTemplateDto {
  @ApiProperty({ description: 'Template name (unique)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Message text content' })
  @IsString()
  @IsNotEmpty()
  messageText: string;

  @ApiProperty({ description: 'Target chat IDs (BigInt as strings)', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  targetChatIds: string[];

  @ApiProperty({ description: 'Whether the template is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCrossPostTemplateDto {
  @ApiProperty({ description: 'Template name (unique)', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Message text content', required: false })
  @IsString()
  @IsOptional()
  messageText?: string;

  @ApiProperty({ description: 'Target chat IDs (BigInt as strings)', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetChatIds?: string[];

  @ApiProperty({ description: 'Whether the template is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
