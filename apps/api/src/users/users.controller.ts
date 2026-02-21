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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  UserDto,
  UserListResponseDto,
  UserStatsDto,
  PaginationDto,
  BanUserDto,
} from './dto';

@ApiTags('users')
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of users' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated list of users with optional filtering',
    type: UserListResponseDto,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by username (partial match, case-insensitive)',
  })
  @ApiQuery({
    name: 'isBanned',
    required: false,
    type: Boolean,
    description: 'Filter by banned status',
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('isBanned') isBanned?: string,
  ): Promise<UserListResponseDto> {
    const parsedIsBanned = isBanned === 'true' ? true : isBanned === 'false' ? false : undefined;
    return this.usersService.findAll(page, limit, search, parsedIsBanned);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns user dashboard statistics',
    type: UserStatsDto,
  })
  async getStats(): Promise<UserStatsDto> {
    return this.usersService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns a single user by ID',
    type: UserDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: 'clx1234567890',
  })
  async findOne(@Param('id') id: string): Promise<UserDto> {
    return this.usersService.findOne(id);
  }

  @Put(':id/ban')
  @ApiOperation({ summary: 'Ban or unban a user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User ban status updated successfully',
    type: UserDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: 'clx1234567890',
  })
  async setBanStatus(
    @Param('id') id: string,
    @Body() banUserDto: BanUserDto,
  ): Promise<UserDto> {
    return this.usersService.setBanStatus(id, banUserDto.isBanned, banUserDto.banReason);
  }
}
