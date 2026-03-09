import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  DefaultValuePipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ScheduledMessagesService } from './scheduled-messages.service';
import {
  ScheduledMessageDto,
  ScheduledMessageListResponseDto,
  CreateScheduledMessageDto,
} from './dto';

@ApiTags('scheduled-messages')
@Controller('api/moderation/scheduled-messages')
export class ScheduledMessagesController {
  constructor(private readonly scheduledMessagesService: ScheduledMessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of scheduled messages' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated scheduled messages',
    type: ScheduledMessageListResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'groupId', required: false, type: String })
  @ApiQuery({ name: 'sent', required: false, type: Boolean })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('groupId') groupId?: string,
    @Query('sent') sent?: string,
  ): Promise<ScheduledMessageListResponseDto> {
    const parsedSent =
      sent === 'true' ? true : sent === 'false' ? false : undefined;
    return this.scheduledMessagesService.findAll(page, limit, groupId, parsedSent);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new scheduled message' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Scheduled message created',
    type: ScheduledMessageDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input or sendAt is in the past' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  async create(
    @Body() dto: CreateScheduledMessageDto,
  ): Promise<ScheduledMessageDto> {
    return this.scheduledMessagesService.create(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a scheduled message' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Scheduled message deleted',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Scheduled message not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Message already sent' })
  @ApiParam({ name: 'id', description: 'Scheduled message ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.scheduledMessagesService.remove(id);
  }
}
