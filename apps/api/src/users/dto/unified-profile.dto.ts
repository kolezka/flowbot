import { ApiProperty } from '@nestjs/swagger';

export class GroupMembershipDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  chatId!: string;

  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  joinedAt!: Date;

  @ApiProperty()
  messageCount!: number;

  @ApiProperty()
  lastSeenAt!: Date;

  @ApiProperty()
  activeWarnings!: WarningDto[];
}

export class WarningDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ required: false })
  reason?: string;

  @ApiProperty()
  issuerId!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ required: false })
  expiresAt?: Date;

  @ApiProperty()
  createdAt!: Date;
}

export class ModerationLogEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  actorId!: string;

  @ApiProperty({ required: false })
  reason?: string;

  @ApiProperty({ required: false })
  details?: any;

  @ApiProperty()
  automated!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ required: false })
  groupTitle?: string;
}

export class UnifiedProfileDto {
  @ApiProperty()
  telegramId!: string;

  @ApiProperty()
  reputationScore!: number;

  @ApiProperty()
  firstSeenAt!: Date;

  @ApiProperty({ required: false, description: 'Sales bot user data, null if not linked' })
  user?: {
    id: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
    isBanned: boolean;
    banReason?: string;
    messageCount: number;
    commandCount: number;
    verifiedAt?: Date;
    createdAt: Date;
  };

  @ApiProperty({ type: [GroupMembershipDto] })
  memberships!: GroupMembershipDto[];

  @ApiProperty({ type: [ModerationLogEntryDto] })
  moderationLogs!: ModerationLogEntryDto[];
}
