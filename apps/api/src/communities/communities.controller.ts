import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  DefaultValuePipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CommunitiesService } from './communities.service';
import {
  CommunityDto,
  CommunityListResponseDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  CommunityConfigDto,
  UpdateCommunityConfigDto,
  CommunityTelegramConfigDto,
  UpdateTelegramConfigDto,
  CommunityDiscordConfigDto,
  UpdateDiscordConfigDto,
} from './dto';

@ApiTags('communities')
@Controller('api/communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of communities' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated list of communities',
    type: CommunityListResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'platform', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('platform') platform?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ): Promise<CommunityListResponseDto> {
    const parsedIsActive =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.communitiesService.findAll(page, limit, platform, search, parsedIsActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get community detail with config' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns community detail',
    type: CommunityDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Community not found' })
  @ApiParam({ name: 'id', description: 'Community ID' })
  async findOne(@Param('id') id: string) {
    return this.communitiesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new community' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Returns created community',
    type: CommunityDto,
  })
  async create(@Body() dto: CreateCommunityDto): Promise<CommunityDto> {
    return this.communitiesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a community' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns updated community',
    type: CommunityDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Community not found' })
  @ApiParam({ name: 'id', description: 'Community ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommunityDto,
  ): Promise<CommunityDto> {
    return this.communitiesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a community' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Community deactivated',
    type: CommunityDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Community not found' })
  @ApiParam({ name: 'id', description: 'Community ID' })
  async deactivate(@Param('id') id: string): Promise<CommunityDto> {
    return this.communitiesService.deactivate(id);
  }

  @Get(':id/config')
  @ApiOperation({ summary: 'Get community configuration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns community config',
    type: CommunityConfigDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Community or config not found' })
  @ApiParam({ name: 'id', description: 'Community ID' })
  async getConfig(@Param('id') id: string): Promise<CommunityConfigDto> {
    return this.communitiesService.getConfig(id);
  }

  @Put(':id/config')
  @ApiOperation({ summary: 'Update community configuration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns updated config',
    type: CommunityConfigDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Community not found' })
  @ApiParam({ name: 'id', description: 'Community ID' })
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateCommunityConfigDto,
  ): Promise<CommunityConfigDto> {
    return this.communitiesService.updateConfig(id, dto);
  }

  @Get(':id/config/telegram')
  @ApiOperation({ summary: 'Get Telegram-specific community configuration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns Telegram config',
    type: CommunityTelegramConfigDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Community or config not found' })
  @ApiParam({ name: 'id', description: 'Community ID' })
  async getTelegramConfig(
    @Param('id') id: string,
  ): Promise<CommunityTelegramConfigDto> {
    return this.communitiesService.getTelegramConfig(id);
  }

  @Put(':id/config/telegram')
  @ApiOperation({ summary: 'Update Telegram-specific community configuration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns updated Telegram config',
    type: CommunityTelegramConfigDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Community not found' })
  @ApiParam({ name: 'id', description: 'Community ID' })
  async updateTelegramConfig(
    @Param('id') id: string,
    @Body() dto: UpdateTelegramConfigDto,
  ): Promise<CommunityTelegramConfigDto> {
    return this.communitiesService.updateTelegramConfig(id, dto);
  }

  @Get(':id/config/discord')
  @ApiOperation({ summary: 'Get Discord-specific community configuration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns Discord config',
    type: CommunityDiscordConfigDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Community or config not found' })
  @ApiParam({ name: 'id', description: 'Community ID' })
  async getDiscordConfig(
    @Param('id') id: string,
  ): Promise<CommunityDiscordConfigDto> {
    return this.communitiesService.getDiscordConfig(id);
  }

  @Put(':id/config/discord')
  @ApiOperation({ summary: 'Update Discord-specific community configuration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns updated Discord config',
    type: CommunityDiscordConfigDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Community not found' })
  @ApiParam({ name: 'id', description: 'Community ID' })
  async updateDiscordConfig(
    @Param('id') id: string,
    @Body() dto: UpdateDiscordConfigDto,
  ): Promise<CommunityDiscordConfigDto> {
    return this.communitiesService.updateDiscordConfig(id, dto);
  }
}
