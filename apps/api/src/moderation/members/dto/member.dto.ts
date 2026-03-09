import { ApiProperty } from '@nestjs/swagger';

export class MemberWarningDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  issuerId: string;

  @ApiProperty({ required: false })
  reason?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false })
  expiresAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class MemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  groupId: string;

  @ApiProperty()
  telegramId: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty()
  messageCount: number;

  @ApiProperty()
  lastSeenAt: Date;

  @ApiProperty()
  isQuarantined: boolean;

  @ApiProperty({ required: false })
  quarantineExpiresAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class MemberDetailDto extends MemberDto {
  @ApiProperty({ type: [MemberWarningDto] })
  warnings: MemberWarningDto[];
}

export class MemberListResponseDto {
  @ApiProperty({ type: [MemberDto] })
  data: MemberDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
