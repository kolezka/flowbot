import {
  Controller,
  Get,
  Post,
  Patch,
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
import { BroadcastService } from './broadcast.service';
import {
  BroadcastDto,
  BroadcastListResponseDto,
  CreateBroadcastDto,
  UpdateBroadcastDto,
} from './dto';

@ApiTags('broadcast')
@Controller('api/broadcast')
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of broadcasts' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated list of broadcasts',
    type: BroadcastListResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<BroadcastListResponseDto> {
    return this.broadcastService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get broadcast by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns a single broadcast by ID',
    type: BroadcastDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Broadcast not found',
  })
  @ApiParam({ name: 'id', description: 'Broadcast ID' })
  async findOne(@Param('id') id: string): Promise<BroadcastDto> {
    return this.broadcastService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new broadcast' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Broadcast created successfully',
    type: BroadcastDto,
  })
  async create(@Body() createBroadcastDto: CreateBroadcastDto): Promise<BroadcastDto> {
    return this.broadcastService.create(createBroadcastDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a pending broadcast' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Broadcast updated successfully',
    type: BroadcastDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Broadcast not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Only pending broadcasts can be edited',
  })
  @ApiParam({ name: 'id', description: 'Broadcast ID' })
  async update(
    @Param('id') id: string,
    @Body() updateBroadcastDto: UpdateBroadcastDto,
  ): Promise<BroadcastDto> {
    return this.broadcastService.update(id, updateBroadcastDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a broadcast' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Broadcast deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Broadcast not found',
  })
  @ApiParam({ name: 'id', description: 'Broadcast ID' })
  async remove(@Param('id') id: string) {
    return this.broadcastService.remove(id);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed broadcast' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Broadcast retried successfully (new broadcast created)',
    type: BroadcastDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Broadcast not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Only failed broadcasts can be retried',
  })
  @ApiParam({ name: 'id', description: 'Broadcast ID' })
  async retry(@Param('id') id: string): Promise<BroadcastDto> {
    return this.broadcastService.retry(id);
  }
}
