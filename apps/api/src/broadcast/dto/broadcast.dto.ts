import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNotEmpty, IsOptional } from 'class-validator';

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
