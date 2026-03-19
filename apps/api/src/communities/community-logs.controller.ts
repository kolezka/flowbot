import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CommunityLogsService } from './community-logs.service';

@ApiTags('communities')
@Controller('api/communities/:communityId/logs')
export class CommunityLogsController {
  constructor(private readonly logsService: CommunityLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Get moderation logs for a community' })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Param('communityId') communityId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.logsService.findByCommunity(communityId, page, limit);
  }
}
