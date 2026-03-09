import {
  Controller,
  Get,
  Param,
  Query,
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
import { MemberListResponseDto, MemberDetailDto } from './dto';

@ApiTags('group-members')
@Controller('api/groups/:groupId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of group members' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated group members',
    type: MemberListResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, type: String })
  async findAll(
    @Param('groupId') groupId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('role') role?: string,
  ): Promise<MemberListResponseDto> {
    return this.membersService.findAll(groupId, page, limit, role);
  }

  @Get(':memberId')
  @ApiOperation({ summary: 'Get member detail with warnings' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns member detail with warnings',
    type: MemberDetailDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Member not found' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  async findOne(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
  ): Promise<MemberDetailDto> {
    return this.membersService.findOne(groupId, memberId);
  }
}
