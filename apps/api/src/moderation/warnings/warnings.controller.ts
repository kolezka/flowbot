import {
  Controller,
  Get,
  Delete,
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
import { WarningsService } from './warnings.service';
import { WarningDto, WarningListResponseDto, WarningStatsDto } from './dto';

@ApiTags('warnings')
@Controller('api/warnings')
export class WarningsController {
  constructor(private readonly warningsService: WarningsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of warnings' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated warnings',
    type: WarningListResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'groupId', required: false, type: String })
  @ApiQuery({ name: 'memberId', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('groupId') groupId?: string,
    @Query('memberId') memberId?: string,
    @Query('isActive') isActive?: string,
  ): Promise<WarningListResponseDto> {
    const parsedIsActive =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.warningsService.findAll(page, limit, groupId, memberId, parsedIsActive);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get warning statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns warning counts by group and escalation stats',
    type: WarningStatsDto,
  })
  async getStats(): Promise<WarningStatsDto> {
    return this.warningsService.getStats();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a warning (set isActive=false)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Warning deactivated',
    type: WarningDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Warning not found' })
  @ApiParam({ name: 'id', description: 'Warning ID' })
  async deactivate(@Param('id') id: string): Promise<WarningDto> {
    return this.warningsService.deactivate(id);
  }
}
