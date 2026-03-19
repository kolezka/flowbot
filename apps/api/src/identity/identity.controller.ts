import {
  Controller, Get, Post, Delete, Param, Query, Body,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IdentityService } from './identity.service';
import { UserIdentityDto, UserIdentityListResponseDto, LinkAccountDto } from './dto';

@ApiTags('identities')
@Controller('api/identities')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated identities with linked accounts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ): Promise<UserIdentityListResponseDto> {
    return this.identityService.findAll(page, limit, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get identity by ID' })
  async findOne(@Param('id') id: string): Promise<UserIdentityDto> {
    return this.identityService.findOne(id);
  }

  @Post(':id/link')
  @ApiOperation({ summary: 'Link a platform account to this identity' })
  async linkAccount(
    @Param('id') id: string,
    @Body() dto: LinkAccountDto,
  ): Promise<UserIdentityDto> {
    return this.identityService.linkAccount(id, dto.platformAccountId);
  }

  @Delete(':id/link/:accountId')
  @ApiOperation({ summary: 'Unlink a platform account from this identity' })
  async unlinkAccount(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
  ): Promise<UserIdentityDto> {
    return this.identityService.unlinkAccount(id, accountId);
  }
}
