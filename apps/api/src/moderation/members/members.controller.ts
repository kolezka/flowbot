import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
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
import type { Response } from 'express';
import { MembersService } from './members.service';
import { MemberListResponseDto, MemberDetailDto } from './dto';
import { toCsv } from '../../common/csv.util';

@ApiTags('group-members')
@Controller('api/moderation/groups/:groupId/members')
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
  @ApiQuery({ name: 'isQuarantined', required: false, type: Boolean })
  async findAll(
    @Param('groupId') groupId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('role') role?: string,
    @Query('isQuarantined') isQuarantined?: string,
  ): Promise<MemberListResponseDto> {
    const quarantineBool =
      isQuarantined !== undefined ? isQuarantined === 'true' : undefined;
    return this.membersService.findAll(
      groupId,
      page,
      limit,
      role,
      quarantineBool,
    );
  }

  @Post(':memberId/release')
  @ApiOperation({ summary: 'Release member from quarantine' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member released from quarantine',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Member not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Member not quarantined',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  async releaseMember(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.membersService.releaseMember(groupId, memberId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export group members as CSV or JSON' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'json'] })
  @ApiQuery({ name: 'role', required: false, type: String })
  async exportMembers(
    @Param('groupId') groupId: string,
    @Query('format') format: string = 'csv',
    @Query('role') role?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.membersService.findAllForExport(groupId, role);

    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      res.header('Content-Type', 'application/json');
      res.header(
        'Content-Disposition',
        `attachment; filename="members-${groupId}-${dateStr}.json"`,
      );
      return data;
    }

    const headers = [
      'ID',
      'Telegram ID',
      'Role',
      'Message Count',
      'Joined At',
      'Last Seen At',
      'Is Quarantined',
    ];
    const rows = data.map((m) => [
      m.id,
      m.telegramId,
      m.role,
      m.messageCount,
      new Date(m.joinedAt).toISOString(),
      new Date(m.lastSeenAt).toISOString(),
      m.isQuarantined ? 'Yes' : 'No',
    ]);

    const csv = toCsv(headers, rows);
    res.header('Content-Type', 'text/csv');
    res.header(
      'Content-Disposition',
      `attachment; filename="members-${groupId}-${dateStr}.csv"`,
    );
    return csv;
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
