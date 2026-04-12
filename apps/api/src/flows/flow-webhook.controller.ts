import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { FlowsService } from './flows.service';
import type { FlowTriggerEvent } from './flow-trigger-event';

/**
 * Generic event ingestion endpoint for platform connectors.
 *
 * All connectors (Telegram, Discord, WhatsApp) POST events here via
 * the EventForwarder from platform-kit. The endpoint matches incoming
 * events against active flow triggers and creates FlowExecution records.
 *
 * Mounted at /api/flow/webhook to match the EventForwarder default path.
 */
@ApiTags('Flow Webhook')
@Controller('api/flow')
export class FlowWebhookController {
  private readonly logger = new Logger(FlowWebhookController.name);

  constructor(private readonly service: FlowsService) {}

  @Public()
  @Post('webhook')
  @ApiOperation({
    summary: 'Receive platform events and match to active flows',
  })
  @ApiResponse({ status: 200, description: 'Event received and processed' })
  async ingest(@Body() event: FlowTriggerEvent) {
    const matched = await this.service.matchAndExecute(event);
    this.logger.log(
      `Event received: ${event.eventType} from ${event.platform} — matched ${matched.length} flow(s)`,
    );
    return {
      received: true,
      matched: matched.length,
      executions: matched,
      timestamp: new Date(),
    };
  }
}
