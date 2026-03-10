import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FlowsService } from './flows.service';
import { CreateFlowDto, UpdateFlowDto } from './dto';

@ApiTags('Flows')
@Controller('api/flows')
export class FlowsController {
  constructor(private readonly service: FlowsService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('status') status?: string) {
    return this.service.findAll(page ? parseInt(page) : undefined, limit ? parseInt(limit) : undefined, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: CreateFlowDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFlowDto) { return this.service.update(id, dto); }

  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }

  @Post(':id/validate')
  validate(@Param('id') id: string) { return this.service.validate(id); }

  @Post(':id/activate')
  activate(@Param('id') id: string) { return this.service.activate(id); }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) { return this.service.deactivate(id); }

  @Get(':id/executions')
  getExecutions(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.getExecutions(id, page ? parseInt(page) : undefined, limit ? parseInt(limit) : undefined);
  }

  @Post('webhook/:flowId')
  async webhookIngress(@Param('flowId') flowId: string, @Body() body: any) {
    // Validate flow exists and is active
    const flow = await this.service.findOne(flowId);
    if (flow.status !== 'active') {
      throw new BadRequestException('Flow is not active');
    }

    // Trigger flow execution (would use Trigger.dev in production)
    return { received: true, flowId, timestamp: new Date() };
  }
}
