import { PrismaService } from '../../prisma/prisma.service';

type MockPrismaModel = {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  upsert: jest.Mock;
};

function createMockModel(): MockPrismaModel {
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

export type MockPrismaService = {
  [K in keyof PrismaService]: K extends '$connect' | '$disconnect'
    ? jest.Mock
    : K extends string
      ? MockPrismaModel
      : PrismaService[K];
};

export function createMockPrismaService(): MockPrismaService {
  return {
    user: createMockModel(),
    category: createMockModel(),
    product: createMockModel(),
    cart: createMockModel(),
    cartItem: createMockModel(),
    userIdentity: createMockModel(),
    managedGroup: createMockModel(),
    groupConfig: createMockModel(),
    groupMember: createMockModel(),
    warning: createMockModel(),
    moderationLog: createMockModel(),
    scheduledMessage: createMockModel(),
    groupAnalyticsSnapshot: createMockModel(),
    reputationScore: createMockModel(),
    crossPostTemplate: createMockModel(),
    broadcastMessage: createMockModel(),
    orderEvent: createMockModel(),
    clientLog: createMockModel(),
    clientSession: createMockModel(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  } as unknown as MockPrismaService;
}
