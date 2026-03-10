import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Bot Instance DTOs
export class CreateBotInstanceDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() botToken: string;
  @ApiPropertyOptional() @IsOptional() @IsString() botUsername?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
}

export class UpdateBotInstanceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() botUsername?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

// Command DTOs
export class CreateBotCommandDto {
  @ApiProperty() @IsString() command: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateBotCommandDto {
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

// Response DTOs
export class CreateBotResponseDto {
  @ApiProperty() @IsString() key: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locale?: string;
  @ApiProperty() @IsString() text: string;
}

export class UpdateBotResponseDto {
  @ApiPropertyOptional() @IsOptional() @IsString() text?: string;
}

// Menu DTOs
export class CreateBotMenuDto {
  @ApiProperty() @IsString() name: string;
}

export class CreateBotMenuButtonDto {
  @ApiProperty() @IsString() label: string;
  @ApiProperty() @IsString() action: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() row?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() col?: number;
}

export class UpdateBotMenuButtonDto {
  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() row?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() col?: number;
}
