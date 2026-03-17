import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LogsService } from './logs.service';

@ApiTags('Moderation Logs')
@Controller('api/moderation/logs')
export class LogsController {
  constructor(private readonly service: LogsService) {}

  @Get()
  @ApiOperation({ summary: 'List moderation logs' })
  @ApiQuery({ name: 'groupId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('groupId') groupId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(
      groupId,
      page ? parseInt(page) : undefined,
      limit ? parseInt(limit) : undefined,
    );
  }
}
