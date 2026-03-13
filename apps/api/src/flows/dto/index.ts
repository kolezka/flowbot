import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFlowDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() platform?: string;
}

export class UpdateFlowDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() platform?: string;
  @ApiPropertyOptional() @IsOptional() nodesJson?: any;
  @ApiPropertyOptional() @IsOptional() edgesJson?: any;
  @ApiPropertyOptional() @IsOptional() transportConfig?: { transport: string; botInstanceId?: string; platform?: string; discordBotInstanceId?: string };
}
