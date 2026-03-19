import { ApiProperty } from '@nestjs/swagger';
import { PlatformAccountDto } from './platform-account.dto';

export class UserIdentityDto {
  @ApiProperty() id!: string;
  @ApiProperty({ required: false }) displayName?: string;
  @ApiProperty({ required: false }) email?: string;
  @ApiProperty({ type: [PlatformAccountDto] }) platformAccounts!: PlatformAccountDto[];
  @ApiProperty() createdAt!: Date;
}

export class UserIdentityListResponseDto {
  @ApiProperty({ type: [UserIdentityDto] }) data!: UserIdentityDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class LinkAccountDto {
  @ApiProperty() platformAccountId!: string;
}
