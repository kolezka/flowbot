import { PrismaClient, User } from '@flowbot/db';
import { prismaClient } from '../database';
import { UserDataUpsertDTO } from '../dto/UserDataUpsertDTO';

export class UserRepository {
  constructor(private prisma: PrismaClient) {}
  
  async upsert(dto: UserDataUpsertDTO): Promise<User> {
    const now = dto.seenAt;
    const isMessage = dto.updateKind === 'message';
    const isCommand = dto.isCommand;

    const user = await this.prisma.user.upsert({
      where: { telegramId: dto.telegramId },
      create: {
        telegramId: dto.telegramId,
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        languageCode: dto.languageCode,
        lastChatId: dto.lastChatId,
        lastSeenAt: now,
        lastMessageAt: dto.messageAt,
        messageCount: dto.messageCountDelta,
        commandCount: dto.commandCountDelta,
        // role default from schema (UNVERIFIED)
      },
      update: {
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        languageCode: dto.languageCode,
        lastChatId: dto.lastChatId,
        lastSeenAt: now,
        lastMessageAt: isMessage ? (dto.messageAt ?? now) : undefined,
        messageCount:
          isMessage && dto.messageCountDelta > 0
            ? { increment: dto.messageCountDelta }
            : undefined,
        commandCount:
          isCommand && dto.commandCountDelta > 0
            ? { increment: dto.commandCountDelta }
            : undefined,
      },
    });

    return user

  }
}

export const userRepository = new UserRepository(prismaClient);
