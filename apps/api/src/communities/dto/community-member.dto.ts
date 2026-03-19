import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CommunityMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  communityId: string;

  @ApiProperty()
  platformAccountId: string;

  @ApiProperty({ required: false })
  platform?: string;

  @ApiProperty({ required: false })
  username?: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  messageCount: number;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty()
  warningCount: number;

  @ApiProperty()
  isMuted: boolean;

  @ApiProperty({ required: false })
  muteExpiresAt?: Date;

  @ApiProperty()
  isQuarantined: boolean;

  @ApiProperty({ required: false })
  quarantineExpiresAt?: Date;

  @ApiProperty()
  lastSeenAt: Date;

  @ApiProperty()
  createdAt: Date;
}

export class CommunityMemberListResponseDto {
  @ApiProperty({ type: [CommunityMemberDto] })
  data: CommunityMemberDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class UpdateMemberRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  role: string;
}
