import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  StartAuthDto,
  SubmitCodeDto,
  SubmitPasswordDto,
  UpdateSessionDto,
} from './dto';

@Injectable()
export class TgClientService {
  private readonly logger = new Logger(TgClientService.name);

  constructor(private prisma: PrismaService) {}

  async findAllSessions(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [sessions, total] = await Promise.all([
      this.prisma.clientSession.findMany({
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          isActive: true,
          lastUsedAt: true,
          phoneNumber: true,
          displayName: true,
          dcId: true,
          sessionType: true,
          errorCount: true,
          lastError: true,
          lastErrorAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.clientSession.count(),
    ]);

    return {
      data: sessions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findSession(id: string) {
    const session = await this.prisma.clientSession.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
        lastUsedAt: true,
        phoneNumber: true,
        displayName: true,
        dcId: true,
        sessionType: true,
        errorCount: true,
        lastError: true,
        lastErrorAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  async updateSession(id: string, dto: UpdateSessionDto) {
    await this.findSession(id);
    return this.prisma.clientSession.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        isActive: true,
        lastUsedAt: true,
        phoneNumber: true,
        displayName: true,
        dcId: true,
        sessionType: true,
        errorCount: true,
        lastError: true,
        lastErrorAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deactivateSession(id: string) {
    await this.findSession(id);
    return this.prisma.clientSession.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async rotateSession(id: string) {
    const session = await this.prisma.clientSession.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException(`Session ${id} not found`);

    // Deactivate old session
    await this.prisma.clientSession.update({
      where: { id },
      data: { isActive: false },
    });

    // Create new session placeholder
    const newSession = await this.prisma.clientSession.create({
      data: {
        sessionString: '',
        isActive: false,
        phoneNumber: session.phoneNumber,
        displayName: session.displayName,
        sessionType: session.sessionType,
      },
    });

    this.logger.log(`Session rotated: ${id} -> ${newSession.id}`);
    return newSession;
  }

  async getTransportHealth() {
    const activeSessions = await this.prisma.clientSession.count({
      where: { isActive: true },
    });
    const errorSessions = await this.prisma.clientSession.count({
      where: { errorCount: { gt: 0 }, isActive: true },
    });
    const recentLogs = await this.prisma.clientLog.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 3600_000) } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      activeSessions,
      errorSessions,
      healthySessions: activeSessions - errorSessions,
      recentLogs,
      lastChecked: new Date(),
    };
  }

  // Auth flow stubs - in production these would proxy to telegram-transport
  async startAuth(dto: StartAuthDto) {
    const session = await this.prisma.clientSession.create({
      data: {
        sessionString: '',
        isActive: false,
        phoneNumber: dto.phoneNumber,
      },
    });
    this.logger.log(
      `Auth started for ${dto.phoneNumber}, session ${session.id}`,
    );
    return { sessionId: session.id, status: 'code_required' };
  }

  async submitCode(dto: SubmitCodeDto) {
    await this.findSession(dto.sessionId);
    this.logger.log(`Code submitted for session ${dto.sessionId}`);
    // In production, this would validate with MTProto
    return { sessionId: dto.sessionId, status: 'password_required' };
  }

  async submitPassword(dto: SubmitPasswordDto) {
    await this.findSession(dto.sessionId);
    this.logger.log(`Password submitted for session ${dto.sessionId}`);
    // In production, this would complete MTProto auth
    return { sessionId: dto.sessionId, status: 'authenticated' };
  }
}
