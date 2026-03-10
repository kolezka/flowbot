import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'List all webhook endpoints' })
  @ApiResponse({ status: 200, description: 'List of webhook endpoints' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook endpoint by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Webhook endpoint ID' })
  @ApiResponse({ status: 200, description: 'Webhook endpoint details' })
  @ApiResponse({ status: 404, description: 'Webhook endpoint not found' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new webhook endpoint' })
  @ApiResponse({ status: 201, description: 'Webhook endpoint created' })
  create(@Body() data: { name: string; flowId?: string }) {
    return this.service.create(data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  @ApiParam({ name: 'id', type: String, description: 'Webhook endpoint ID' })
  @ApiResponse({ status: 200, description: 'Webhook endpoint deleted' })
  @ApiResponse({ status: 404, description: 'Webhook endpoint not found' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post('incoming/:token')
  @ApiOperation({ summary: 'Handle incoming webhook payload' })
  @ApiParam({ name: 'token', type: String, description: 'Webhook token' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 404, description: 'Webhook token not found' })
  handleIncoming(@Param('token') token: string, @Body() payload: any) {
    return this.service.handleIncoming(token, payload);
  }
}
