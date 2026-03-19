import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CommunityWarningsService } from './community-warnings.service';

@ApiTags('communities')
@Controller('api/communities/:communityId/warnings')
export class CommunityWarningsController {
  constructor(private readonly warningsService: CommunityWarningsService) {}

  @Get()
  @ApiOperation({ summary: 'Get warnings for a community' })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async findAll(
    @Param('communityId') communityId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isActive') isActive?: string,
  ) {
    const parsedActive =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.warningsService.findByCommunity(communityId, page, limit, parsedActive);
  }
}
