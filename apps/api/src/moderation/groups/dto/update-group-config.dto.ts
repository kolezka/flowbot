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

export class UpdateGroupConfigDto {
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
  @IsBoolean()
  antiSpamEnabled?: boolean;

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

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  antiLinkWhitelist?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  slowModeDelay?: number;

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
  aiModEnabled?: boolean;

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
