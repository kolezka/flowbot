import {
  Controller, Get, Put, Param, Query, Body,
  ParseIntPipe, DefaultValuePipe, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { PlatformAccountDto, PlatformAccountListResponseDto, AccountStatsDto, BanAccountDto } from './dto';

@ApiTags('accounts')
@Controller('api/accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated platform accounts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isBanned', required: false, type: Boolean })
  @ApiQuery({ name: 'platform', required: false, type: String })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('isBanned') isBanned?: string,
    @Query('platform') platform?: string,
  ): Promise<PlatformAccountListResponseDto> {
    const parsedBanned = isBanned === 'true' ? true : isBanned === 'false' ? false : undefined;
    return this.accountsService.findAll(page, limit, search, parsedBanned, platform);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get account statistics' })
  async getStats(): Promise<AccountStatsDto> {
    return this.accountsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by ID' })
  async findOne(@Param('id') id: string): Promise<PlatformAccountDto> {
    return this.accountsService.findOne(id);
  }

  @Put(':id/ban')
  @ApiOperation({ summary: 'Ban or unban an account' })
  async setBanStatus(
    @Param('id') id: string,
    @Body() dto: BanAccountDto,
  ): Promise<PlatformAccountDto> {
    return this.accountsService.setBanStatus(id, dto.isBanned, dto.banReason);
  }
}
