import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ConnectionDto {
  @ApiProperty() id!: string;
  @ApiProperty() platform!: string;
  @ApiProperty() name!: string;
  @ApiProperty() connectionType!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ required: false }) metadata?: Record<string, unknown>;
  @ApiProperty() errorCount!: number;
  @ApiProperty({ required: false }) lastErrorMessage?: string;
  @ApiProperty({ required: false }) lastActiveAt?: Date;
  @ApiProperty({ required: false }) botInstanceId?: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class ConnectionListResponseDto {
  @ApiProperty({ type: [ConnectionDto] }) data!: ConnectionDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class CreateConnectionDto {
  @IsString() @ApiProperty() platform!: string;
  @IsString() @ApiProperty() name!: string;
  @IsString() @ApiProperty() connectionType!: string;
  @IsOptional() @ApiProperty({ required: false }) metadata?: Record<string, unknown>;
  @IsOptional() @IsString() @ApiProperty({ required: false }) botInstanceId?: string;
}

export class StartAuthDto {
  @ApiProperty() params!: Record<string, unknown>;
}

export class SubmitAuthStepDto {
  @IsString() @ApiProperty() step!: string;
  @ApiProperty() data!: unknown;
}

export class UpdateStatusDto {
  @IsString() @ApiProperty() status!: string;
  @IsOptional() @IsString() @ApiProperty({ required: false }) errorMessage?: string;
}

export class ConnectionLogDto {
  @ApiProperty() id!: string;
  @ApiProperty() connectionId!: string;
  @ApiProperty() level!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ required: false }) details?: Record<string, unknown>;
  @ApiProperty() createdAt!: Date;
}

export class ConnectionHealthDto {
  @ApiProperty() totalConnections!: number;
  @ApiProperty() activeConnections!: number;
  @ApiProperty() errorConnections!: number;
  @ApiProperty() platforms!: Record<string, { total: number; active: number; error: number }>;
}
