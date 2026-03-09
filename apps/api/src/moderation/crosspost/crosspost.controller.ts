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
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CrossPostService } from './crosspost.service';
import {
  CrossPostTemplateDto,
  CrossPostTemplateListResponseDto,
  CreateCrossPostTemplateDto,
  UpdateCrossPostTemplateDto,
} from './dto';

@ApiTags('crosspost-templates')
@Controller('api/moderation/crosspost-templates')
export class CrossPostController {
  constructor(private readonly crossPostService: CrossPostService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of crosspost templates' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated crosspost templates',
    type: CrossPostTemplateListResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isActive') isActive?: string,
  ): Promise<CrossPostTemplateListResponseDto> {
    const parsedIsActive =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.crossPostService.findAll(page, limit, parsedIsActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a crosspost template by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the crosspost template',
    type: CrossPostTemplateDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Template not found' })
  @ApiParam({ name: 'id', description: 'CrossPost template ID' })
  async findOne(@Param('id') id: string): Promise<CrossPostTemplateDto> {
    return this.crossPostService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new crosspost template' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'CrossPost template created',
    type: CrossPostTemplateDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  async create(
    @Body() dto: CreateCrossPostTemplateDto,
  ): Promise<CrossPostTemplateDto> {
    return this.crossPostService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a crosspost template' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'CrossPost template updated',
    type: CrossPostTemplateDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Template not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiParam({ name: 'id', description: 'CrossPost template ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCrossPostTemplateDto,
  ): Promise<CrossPostTemplateDto> {
    return this.crossPostService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a crosspost template' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'CrossPost template deleted',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Template not found' })
  @ApiParam({ name: 'id', description: 'CrossPost template ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.crossPostService.remove(id);
  }
}
