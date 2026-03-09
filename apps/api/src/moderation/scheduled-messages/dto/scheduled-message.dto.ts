import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ScheduledMessageDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  groupId: string;

  @ApiProperty({ required: false })
  groupTitle?: string;

  @ApiProperty()
  chatId: string;

  @ApiProperty()
  text: string;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  sendAt: Date;

  @ApiProperty()
  sent: boolean;

  @ApiProperty({ required: false })
  sentAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class ScheduledMessageListResponseDto {
  @ApiProperty({ type: [ScheduledMessageDto] })
  data: ScheduledMessageDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class CreateScheduledMessageDto {
  @ApiProperty({ description: 'Group ID' })
  @IsString()
  @IsNotEmpty()
  groupId: string;

  @ApiProperty({ description: 'Message text' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ description: 'Scheduled send time (ISO 8601)' })
  @IsNotEmpty()
  sendAt: string;

  @ApiProperty({ description: 'Creator Telegram ID (BigInt as string)', required: false })
  @IsString()
  @IsOptional()
  createdBy?: string;
}
