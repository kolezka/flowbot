import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBroadcastDto {
  @ApiProperty({ description: 'Broadcast message text' })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty({ description: 'Target chat IDs to send the broadcast to', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  targetChatIds!: string[];
}

export class BroadcastDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({ type: [String] })
  targetChatIds!: string[];

  @ApiProperty({ required: false })
  results?: any;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class BroadcastListResponseDto {
  @ApiProperty({ type: [BroadcastDto] })
  data!: BroadcastDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class CreateMultiPlatformBroadcastDto {
  @ApiProperty({ description: 'Structured content', type: Object })
  @IsNotEmpty()
  content!: { text: string; media?: any; embed?: any };

  @ApiProperty({ description: 'Target platforms', type: [String] })
  @IsArray()
  @IsString({ each: true })
  platforms!: string[];

  @ApiProperty({ description: 'Target community IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  targetCommunities!: string[];
}

export class MultiPlatformBroadcastDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiProperty() content!: { text: string; media?: any; embed?: any };
  @ApiProperty({ type: [String] }) platforms!: string[];
  @ApiProperty({ type: [String] }) targetCommunities!: string[];
  @ApiProperty({ required: false }) results?: any;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
