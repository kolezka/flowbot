import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { PrismaService } from '../prisma/prisma.service';

function createMockModel() {
  return {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  };
}

describe('IdentityService', () => {
  let service: IdentityService;
  let prisma: Record<string, any>;

  const mockPlatformAccount = {
    id: 'acc-1',
    identityId: null,
    platform: 'telegram',
    platformUserId: '12345',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    metadata: { languageCode: 'en' },
    isBanned: false,
    messageCount: 100,
    commandCount: 10,
    isVerified: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
  };

  const mockIdentity = {
    id: 'identity-1',
    displayName: 'Test User',
    email: 'test@example.com',
    reputationScore: 0,
    firstSeenAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
    platformAccounts: [mockPlatformAccount],
  };

  beforeEach(async () => {
    prisma = {
      userIdentity: createMockModel(),
      platformAccount: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<IdentityService>(IdentityService);
  });

  describe('findAll', () => {
    it('should return paginated identities with linked accounts', async () => {
      prisma.userIdentity.findMany.mockResolvedValue([mockIdentity]);
      prisma.userIdentity.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.data[0]?.id).toBe('identity-1');
      expect(result.data[0]?.platformAccounts).toHaveLength(1);
      expect(prisma.userIdentity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          include: expect.objectContaining({ platformAccounts: true }),
        }),
      );
    });

    it('should search by displayName, email, or linked account username', async () => {
      prisma.userIdentity.findMany.mockResolvedValue([]);
      prisma.userIdentity.count.mockResolvedValue(0);

      await service.findAll(1, 20, 'testuser');

      expect(prisma.userIdentity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: expect.arrayContaining([
              expect.objectContaining({ displayName: expect.anything() }),
              expect.objectContaining({ email: expect.anything() }),
              expect.objectContaining({ platformAccounts: expect.anything() }),
            ]),
          },
        }),
      );
    });
  });

  describe('linkAccount', () => {
    it('should link an unlinked account to an identity', async () => {
      const unlinkedAccount = { ...mockPlatformAccount, identityId: null };
      const updatedIdentity = {
        ...mockIdentity,
        platformAccounts: [{ ...unlinkedAccount, identityId: 'identity-1' }],
      };

      prisma.userIdentity.findUnique.mockResolvedValue({ ...mockIdentity, platformAccounts: [] });
      prisma.platformAccount.findUnique.mockResolvedValue(unlinkedAccount);
      prisma.platformAccount.update.mockResolvedValue({ ...unlinkedAccount, identityId: 'identity-1' });
      prisma.userIdentity.findUnique
        .mockResolvedValueOnce({ ...mockIdentity, platformAccounts: [] })
        .mockResolvedValueOnce(updatedIdentity);

      const result = await service.linkAccount('identity-1', 'acc-1');

      expect(prisma.platformAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { identityId: 'identity-1' },
      });
      expect(result.id).toBe('identity-1');
    });

    it('should throw BadRequestException if account already linked to another identity', async () => {
      const linkedAccount = { ...mockPlatformAccount, identityId: 'other-identity' };

      prisma.userIdentity.findUnique.mockResolvedValue({ ...mockIdentity, platformAccounts: [] });
      prisma.platformAccount.findUnique.mockResolvedValue(linkedAccount);

      await expect(service.linkAccount('identity-1', 'acc-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if identity does not exist', async () => {
      prisma.userIdentity.findUnique.mockResolvedValue(null);

      await expect(service.linkAccount('nonexistent', 'acc-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if account does not exist', async () => {
      prisma.userIdentity.findUnique.mockResolvedValue({ ...mockIdentity, platformAccounts: [] });
      prisma.platformAccount.findUnique.mockResolvedValue(null);

      await expect(service.linkAccount('identity-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('unlinkAccount', () => {
    it('should unlink an account from an identity', async () => {
      const linkedAccount = { ...mockPlatformAccount, identityId: 'identity-1' };
      const updatedIdentity = { ...mockIdentity, platformAccounts: [] };

      prisma.userIdentity.findUnique
        .mockResolvedValueOnce(mockIdentity)
        .mockResolvedValueOnce(updatedIdentity);
      prisma.platformAccount.findUnique.mockResolvedValue(linkedAccount);
      prisma.platformAccount.update.mockResolvedValue({ ...linkedAccount, identityId: null });

      const result = await service.unlinkAccount('identity-1', 'acc-1');

      expect(prisma.platformAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { identityId: null },
      });
      expect(result.id).toBe('identity-1');
    });

    it('should throw BadRequestException if account not linked to this identity', async () => {
      const linkedToOther = { ...mockPlatformAccount, identityId: 'other-identity' };

      prisma.userIdentity.findUnique.mockResolvedValue(mockIdentity);
      prisma.platformAccount.findUnique.mockResolvedValue(linkedToOther);

      await expect(service.unlinkAccount('identity-1', 'acc-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if account is not linked at all', async () => {
      const unlinkedAccount = { ...mockPlatformAccount, identityId: null };

      prisma.userIdentity.findUnique.mockResolvedValue(mockIdentity);
      prisma.platformAccount.findUnique.mockResolvedValue(unlinkedAccount);

      await expect(service.unlinkAccount('identity-1', 'acc-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if identity does not exist', async () => {
      prisma.userIdentity.findUnique.mockResolvedValue(null);

      await expect(service.unlinkAccount('nonexistent', 'acc-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if account does not exist', async () => {
      prisma.userIdentity.findUnique.mockResolvedValue(mockIdentity);
      prisma.platformAccount.findUnique.mockResolvedValue(null);

      await expect(service.unlinkAccount('identity-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
