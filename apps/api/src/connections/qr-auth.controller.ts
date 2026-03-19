import { Controller, Post, Param, Body, HttpCode, Logger } from '@nestjs/common';
import { EventBusService } from '../events/event-bus.service';

@Controller('api/connections')
export class QrAuthController {
  private readonly logger = new Logger(QrAuthController.name);

  constructor(private readonly eventBus: EventBusService) {}

  @Post(':id/qr-update')
  @HttpCode(200)
  handleQrUpdate(
    @Param('id') connectionId: string,
    @Body()
    body: {
      type: 'qr' | 'connected' | 'error' | 'timeout';
      qr?: string;
      pushName?: string;
      phoneNumber?: string;
      error?: string;
    },
  ) {
    this.logger.debug(`QR auth update for connection ${connectionId}: ${body.type}`);

    this.eventBus.emitQrAuth({
      ...body,
      connectionId,
    });

    return { success: true };
  }
}
