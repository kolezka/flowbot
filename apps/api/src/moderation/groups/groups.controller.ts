import {
  Controller,
  Get,
  Patch,
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
import { GroupsService } from './groups.service';
import {
  GroupListResponseDto,
  GroupDetailDto,
  GroupConfigDto,
  UpdateGroupConfigDto,
} from './dto';

@ApiTags('groups')
@Controller('api/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of managed groups' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated list of groups',
    type: GroupListResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isActive') isActive?: string,
  ): Promise<GroupListResponseDto> {
    const parsedIsActive =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.groupsService.findAll(page, limit, parsedIsActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group detail with config and member count' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns group detail',
    type: GroupDetailDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  async findOne(@Param('id') id: string): Promise<GroupDetailDto> {
    return this.groupsService.findOne(id);
  }

  @Patch(':id/config')
  @ApiOperation({ summary: 'Update group configuration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns updated config',
    type: GroupConfigDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateGroupConfigDto,
  ): Promise<GroupConfigDto> {
    return this.groupsService.updateConfig(id, dto);
  }
}
