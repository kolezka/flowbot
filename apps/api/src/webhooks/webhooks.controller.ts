import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() data: { name: string; flowId?: string }) {
    return this.service.create(data);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post('incoming/:token')
  handleIncoming(@Param('token') token: string, @Body() payload: any) {
    return this.service.handleIncoming(token, payload);
  }
}
