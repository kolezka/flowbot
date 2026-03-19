import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class PlatformAccountDto {
  @ApiProperty() id!: string;
  @ApiProperty() platform!: string;
  @ApiProperty() platformUserId!: string;
  @ApiProperty({ required: false }) identityId?: string;
  @ApiProperty({ required: false }) username?: string;
  @ApiProperty({ required: false }) firstName?: string;
  @ApiProperty({ required: false }) lastName?: string;
  @ApiProperty({ required: false }) metadata?: Record<string, unknown>;
  @ApiProperty() isBanned!: boolean;
  @ApiProperty({ required: false }) bannedAt?: Date;
  @ApiProperty({ required: false }) banReason?: string;
  @ApiProperty() messageCount!: number;
  @ApiProperty() commandCount!: number;
  @ApiProperty() isVerified!: boolean;
  @ApiProperty({ required: false }) verifiedAt?: Date;
  @ApiProperty({ required: false }) lastSeenAt?: Date;
  @ApiProperty({ required: false }) lastMessageAt?: Date;
  @ApiProperty({ required: false }) referralCode?: string;
  @ApiProperty({ required: false }) referredByAccountId?: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class PlatformAccountListResponseDto {
  @ApiProperty({ type: [PlatformAccountDto] }) data!: PlatformAccountDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class BanAccountDto {
  @IsBoolean() @ApiProperty() isBanned!: boolean;
  @IsString() @IsOptional() @ApiProperty({ required: false }) banReason?: string;
}

export class AccountStatsDto {
  @ApiProperty() totalAccounts!: number;
  @ApiProperty() activeAccounts!: number;
  @ApiProperty() bannedAccounts!: number;
  @ApiProperty() newAccountsToday!: number;
  @ApiProperty() verifiedAccounts!: number;
  @ApiProperty() totalMessages!: number;
  @ApiProperty() totalCommands!: number;
  @ApiProperty() platformBreakdown!: Record<string, number>;
}
