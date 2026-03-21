import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IPlatformStrategy,
  PlatformStrategyRegistry,
} from '../../platform/strategy-registry.service';
import { PLATFORMS } from '../../platform/platform.constants';

const BOT_TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]+$/;
const GETME_TIMEOUT_MS = 5000;

interface TelegramBotInfo {
  id: number;
  first_name: string;
  username: string;
  can_join_groups: boolean;
}

@Injectable()
export class TelegramConnectionStrategy implements IPlatformStrategy, OnModuleInit {
  readonly platform = PLATFORMS.TELEGRAM;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PlatformStrategyRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register('connections', this);
  }

  async handleBotTokenAuth(
    connectionId: string,
    botToken: string,
  ): Promise<{ botUsername: string; botName: string }> {
    if (!BOT_TOKEN_PATTERN.test(botToken)) {
      throw new BadRequestException('Bot token format is invalid. Expected format from @BotFather.');
    }

    const existing = await this.prisma.botInstance.findFirst({ where: { botToken } });
    if (existing) {
      throw new BadRequestException('This bot is already connected.');
    }

    const botInfo = await this.fetchBotInfo(botToken);

    await this.prisma.$transaction(async (tx) => {
      const botInstance = await tx.botInstance.create({
        data: {
          name: botInfo.first_name,
          botToken,
          botUsername: botInfo.username,
          platform: 'telegram',
          isActive: true,
        },
      });

      await tx.platformConnection.update({
        where: { id: connectionId },
        data: {
          botInstanceId: botInstance.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          credentials: { botToken } as any,
          status: 'active',
          lastActiveAt: new Date(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: {
            botUsername: botInfo.username,
            botName: botInfo.first_name,
            canJoinGroups: botInfo.can_join_groups,
          } as any,
        },
      });
    });

    return { botUsername: botInfo.username, botName: botInfo.first_name };
  }

  private async fetchBotInfo(botToken: string): Promise<TelegramBotInfo> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GETME_TIMEOUT_MS);

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        signal: controller.signal,
      });
      const result = (await response.json()) as { ok: boolean; result?: TelegramBotInfo };
      if (!result.ok) {
        throw new BadRequestException(
          "Telegram rejected this token. Please check it's correct.",
        );
      }
      return result.result!;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if ((error as Error)?.name === 'AbortError') {
        throw new BadRequestException('Could not reach Telegram. Please try again.');
      }
      throw new BadRequestException('Could not reach Telegram. Please try again.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
