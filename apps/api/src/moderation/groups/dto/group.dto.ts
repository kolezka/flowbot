import { ApiProperty } from '@nestjs/swagger';

export class GroupConfigDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  welcomeEnabled: boolean;

  @ApiProperty({ required: false })
  welcomeMessage?: string;

  @ApiProperty({ required: false })
  rulesText?: string;

  @ApiProperty()
  warnThresholdMute: number;

  @ApiProperty()
  warnThresholdBan: number;

  @ApiProperty()
  warnDecayDays: number;

  @ApiProperty()
  defaultMuteDurationS: number;

  @ApiProperty()
  antiSpamEnabled: boolean;

  @ApiProperty()
  antiSpamMaxMessages: number;

  @ApiProperty()
  antiSpamWindowSeconds: number;

  @ApiProperty()
  antiLinkEnabled: boolean;

  @ApiProperty({ type: [String] })
  antiLinkWhitelist: string[];

  @ApiProperty()
  slowModeDelay: number;

  @ApiProperty({ required: false })
  logChannelId?: string;

  @ApiProperty()
  autoDeleteCommandsS: number;

  @ApiProperty()
  captchaEnabled: boolean;

  @ApiProperty()
  captchaMode: string;

  @ApiProperty()
  captchaTimeoutS: number;

  @ApiProperty()
  quarantineEnabled: boolean;

  @ApiProperty()
  quarantineDurationS: number;

  @ApiProperty()
  silentMode: boolean;

  @ApiProperty()
  keywordFiltersEnabled: boolean;

  @ApiProperty({ type: [String] })
  keywordFilters: string[];

  @ApiProperty()
  aiModEnabled: boolean;

  @ApiProperty()
  aiModThreshold: number;

  @ApiProperty({ type: [String] })
  notificationEvents: string[];

  @ApiProperty()
  pipelineEnabled: boolean;

  @ApiProperty({ required: false })
  pipelineDmTemplate?: string;

  @ApiProperty({ required: false })
  pipelineDeeplink?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class GroupDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  chatId: string;

  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty({ required: false })
  leftAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class GroupDetailDto extends GroupDto {
  @ApiProperty({ required: false, type: GroupConfigDto })
  config?: GroupConfigDto;

  @ApiProperty()
  memberCount: number;
}

export class GroupListResponseDto {
  @ApiProperty({ type: [GroupDto] })
  data: GroupDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
