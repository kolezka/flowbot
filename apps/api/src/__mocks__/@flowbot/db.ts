// Mock for @flowbot/db to avoid importing the generated Prisma client
// which uses import.meta.url (ESM-only syntax incompatible with Jest/CJS)
export class PrismaClient {
  $connect = jest.fn();
  $disconnect = jest.fn();
}

export function createPrismaClient() {
  return new PrismaClient();
}
