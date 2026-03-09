import { ApiProperty } from '@nestjs/swagger';

export class WarningDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  groupId: string;

  @ApiProperty({ required: false })
  groupTitle?: string;

  @ApiProperty()
  memberId: string;

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

export class WarningListResponseDto {
  @ApiProperty({ type: [WarningDto] })
  data: WarningDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class WarningGroupStatsDto {
  @ApiProperty()
  groupId: string;

  @ApiProperty({ required: false })
  groupTitle?: string;

  @ApiProperty()
  activeCount: number;

  @ApiProperty()
  totalCount: number;
}

export class WarningStatsDto {
  @ApiProperty({ type: [WarningGroupStatsDto] })
  countsByGroup: WarningGroupStatsDto[];

  @ApiProperty()
  totalActive: number;

  @ApiProperty()
  totalExpired: number;

  @ApiProperty()
  totalDeactivated: number;
}
