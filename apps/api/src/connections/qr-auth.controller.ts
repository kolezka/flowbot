import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { EventBusService } from '../events/event-bus.service';
import { ConnectionsService } from './connections.service';

@Controller('api/connections')
export class QrAuthController {
  private readonly logger = new Logger(QrAuthController.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly connectionsService: ConnectionsService,
  ) {}

  @Post(':id/qr-update')
  @HttpCode(200)
  async handleQrUpdate(
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
    this.logger.debug(
      `QR auth update for connection ${connectionId}: ${body.type}`,
    );

    if (body.type === 'connected') {
      try {
        await this.connectionsService.updateStatus(connectionId, 'active');
        this.logger.log(`Connection ${connectionId} marked as active`);
      } catch (err) {
        this.logger.error(
          `Failed to mark connection ${connectionId} as active: ${err}`,
        );
      }
    }

    this.eventBus.emitQrAuth({
      ...body,
      connectionId,
    });

    return { success: true };
  }
}
