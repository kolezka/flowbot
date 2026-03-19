import {
  Controller,
  Get,
  Put,
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
import { MembersService } from './members.service';
import {
  CommunityMemberDto,
  CommunityMemberListResponseDto,
  UpdateMemberRoleDto,
} from './dto';

@ApiTags('community-members')
@Controller('api/communities/:communityId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of community members' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated community members',
    type: CommunityMemberListResponseDto,
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  async findAll(
    @Param('communityId') communityId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ): Promise<CommunityMemberListResponseDto> {
    return this.membersService.findAll(communityId, page, limit, search, role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get community member detail' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns community member',
    type: CommunityMemberDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Member not found' })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiParam({ name: 'id', description: 'Member ID' })
  async findOne(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
  ): Promise<CommunityMemberDto> {
    return this.membersService.findOne(communityId, id);
  }

  @Put(':id/role')
  @ApiOperation({ summary: 'Update community member role' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns updated member',
    type: CommunityMemberDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Member not found' })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiParam({ name: 'id', description: 'Member ID' })
  async updateRole(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<CommunityMemberDto> {
    return this.membersService.updateRole(communityId, id, dto.role);
  }
}
