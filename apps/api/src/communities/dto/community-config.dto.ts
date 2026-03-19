import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  Min,
} from 'class-validator';

export class CommunityConfigDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  communityId: string;

  @ApiProperty()
  welcomeEnabled: boolean;

  @ApiProperty({ required: false })
  welcomeMessage?: string;

  @ApiProperty({ required: false })
  rulesText?: string;

  @ApiProperty()
  antiSpamEnabled: boolean;

  @ApiProperty()
  antiSpamAction: string;

  @ApiProperty()
  antiSpamMaxMessages: number;

  @ApiProperty()
  antiSpamWindowSeconds: number;

  @ApiProperty()
  antiLinkEnabled: boolean;

  @ApiProperty()
  antiLinkAction: string;

  @ApiProperty({ type: [String] })
  antiLinkWhitelist: string[];

  @ApiProperty()
  warnThresholdMute: number;

  @ApiProperty()
  warnThresholdBan: number;

  @ApiProperty()
  warnDecayDays: number;

  @ApiProperty()
  defaultMuteDurationS: number;

  @ApiProperty({ required: false })
  logChannelId?: string;

  @ApiProperty()
  autoDeleteCommandsS: number;

  @ApiProperty()
  silentMode: boolean;

  @ApiProperty()
  keywordFiltersEnabled: boolean;

  @ApiProperty({ type: [String] })
  keywordFilters: string[];

  @ApiProperty()
  aiModerationEnabled: boolean;

  @ApiProperty()
  aiModerationAction: string;

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

  @ApiProperty({ required: false })
  metadata?: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UpdateCommunityConfigDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  welcomeEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rulesText?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  antiSpamEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  antiSpamAction?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  antiSpamMaxMessages?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  antiSpamWindowSeconds?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  antiLinkEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  antiLinkAction?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  antiLinkWhitelist?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  warnThresholdMute?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  warnThresholdBan?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  warnDecayDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultMuteDurationS?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logChannelId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  autoDeleteCommandsS?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  silentMode?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  keywordFiltersEnabled?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywordFilters?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  aiModerationEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  aiModerationAction?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  aiModThreshold?: number;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notificationEvents?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  pipelineEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pipelineDmTemplate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pipelineDeeplink?: string;
}

export class CommunityTelegramConfigDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  communityId: string;

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
  slowModeDelay: number;

  @ApiProperty()
  forumTopicMgmt: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UpdateTelegramConfigDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  captchaEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  captchaMode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  captchaTimeoutS?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  quarantineEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  quarantineDurationS?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  slowModeDelay?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  forumTopicMgmt?: boolean;
}

export class CommunityDiscordConfigDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  communityId: string;

  @ApiProperty({ required: false })
  autoModRules?: Record<string, unknown>;

  @ApiProperty({ required: false })
  verificationLevel?: string;

  @ApiProperty({ required: false })
  defaultChannelId?: string;

  @ApiProperty({ required: false })
  modLogChannelId?: string;

  @ApiProperty({ required: false })
  welcomeChannelId?: string;

  @ApiProperty({ required: false })
  roleOnJoin?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UpdateDiscordConfigDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  verificationLevel?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultChannelId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  modLogChannelId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  welcomeChannelId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  roleOnJoin?: string;
}
