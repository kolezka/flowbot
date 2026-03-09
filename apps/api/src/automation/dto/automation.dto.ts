import { ApiProperty } from '@nestjs/swagger';

export class AutomationJobDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ description: 'Message text (preview)' })
  text!: string;

  @ApiProperty({ type: [String] })
  targetChatIds!: string[];

  @ApiProperty({ required: false })
  results?: any;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class AutomationJobListResponseDto {
  @ApiProperty({ type: [AutomationJobDto] })
  data!: AutomationJobDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AutomationStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  pending!: number;

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  failed!: number;
}

export class OrderEventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  orderData!: any;

  @ApiProperty({ type: [String] })
  targetChatIds!: string[];

  @ApiProperty({ required: false })
  jobId?: string;

  @ApiProperty()
  processed!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class OrderEventListResponseDto {
  @ApiProperty({ type: [OrderEventDto] })
  data!: OrderEventDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class ClientLogDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  level!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ required: false })
  details?: any;

  @ApiProperty()
  createdAt!: Date;
}

export class ClientLogListResponseDto {
  @ApiProperty({ type: [ClientLogDto] })
  data!: ClientLogDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}
