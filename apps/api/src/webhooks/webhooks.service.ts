import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.webhookEndpoint.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const webhook = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException(`Webhook ${id} not found`);
    return webhook;
  }

  async create(data: { name: string; flowId?: string }) {
    return this.prisma.webhookEndpoint.create({ data });
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.webhookEndpoint.delete({ where: { id } });
    return { deleted: true };
  }

  async handleIncoming(token: string, payload: any) {
    const webhook = await this.prisma.webhookEndpoint.findUnique({ where: { token } });
    if (!webhook || !webhook.isActive) {
      throw new NotFoundException('Webhook not found or inactive');
    }

    await this.prisma.webhookEndpoint.update({
      where: { id: webhook.id },
      data: { lastCalledAt: new Date(), callCount: { increment: 1 } },
    });

    this.logger.log(`Webhook ${webhook.id} triggered`);
    return { received: true, webhookId: webhook.id, flowId: webhook.flowId };
  }
}
