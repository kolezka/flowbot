import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  telegramId!: string;

  @ApiProperty({ required: false })
  username?: string;

  @ApiProperty({ required: false })
  firstName?: string;

  @ApiProperty({ required: false })
  lastName?: string;

  @ApiProperty({ required: false })
  languageCode?: string;

  @ApiProperty({ required: false })
  lastChatId?: string;

  @ApiProperty({ required: false })
  lastSeenAt?: Date;

  @ApiProperty({ required: false })
  lastMessageAt?: Date;

  @ApiProperty({ required: false })
  verifiedAt?: Date;

  @ApiProperty()
  isBanned!: boolean;

  @ApiProperty({ required: false })
  bannedAt?: Date;

  @ApiProperty({ required: false })
  banReason?: string;

  @ApiProperty()
  messageCount!: number;

  @ApiProperty()
  commandCount!: number;

  @ApiProperty({ required: false })
  referralCode?: string;

  @ApiProperty({ required: false })
  referredByUserId?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class UserListResponseDto {
  @ApiProperty()
  data!: UserDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}
