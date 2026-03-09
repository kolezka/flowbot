import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBroadcastDto {
  @ApiPropertyOptional({ description: 'Updated broadcast message text' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ description: 'Updated target chat IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetChatIds?: string[];
}
