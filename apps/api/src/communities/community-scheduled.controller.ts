import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CommunityScheduledService } from './community-scheduled.service';

@ApiTags('communities')
@Controller('api/communities/:communityId/scheduled-messages')
export class CommunityScheduledController {
  constructor(private readonly scheduledService: CommunityScheduledService) {}

  @Get()
  @ApiOperation({ summary: 'Get scheduled messages for a community' })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sent', required: false, type: Boolean })
  async findAll(
    @Param('communityId') communityId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('sent') sent?: string,
  ) {
    const parsedSent =
      sent === 'true' ? true : sent === 'false' ? false : undefined;
    return this.scheduledService.findByCommunity(communityId, page, limit, parsedSent);
  }
}
