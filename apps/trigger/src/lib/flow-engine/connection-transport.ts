import { pino } from 'pino';
import { GramJsClient } from '@flowbot/telegram-user-connector';
import { getPrisma } from '../prisma.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const transportCache = new Map<string, { transport: GramJsClient; lastUsed: number }>();

const MAX_CACHE_SIZE = 10;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create a GramJS transport for a specific PlatformConnection.
 * Transports are cached by connection ID and evicted after TTL or when cache is full.
 */
export async function getTransportForConnection(connectionId: string): Promise<GramJsClient> {
  const cached = transportCache.get(connectionId);
  if (cached && cached.transport.isConnected()) {
    cached.lastUsed = Date.now();
    return cached.transport;
  }

  evictStaleEntries();

  const prisma = getPrisma();
  const connection = await prisma.platformConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error(`PlatformConnection ${connectionId} not found`);
  }

  if (connection.status !== 'active') {
    throw new Error(`PlatformConnection ${connectionId} is not active (status: ${connection.status})`);
  }

  if (connection.connectionType !== 'mtproto') {
    throw new Error(`PlatformConnection ${connectionId} is not an MTProto connection (type: ${connection.connectionType})`);
  }

  const credentials = connection.credentials as Record<string, unknown> | null;
  const sessionString = credentials?.sessionString as string | undefined;

  if (!sessionString) {
    throw new Error(`PlatformConnection ${connectionId} has no session string`);
  }

  const apiId = Number(process.env.TG_CLIENT_API_ID);
  const apiHash = process.env.TG_CLIENT_API_HASH;

  if (!apiId || !apiHash) {
    throw new Error('TG_CLIENT_API_ID and TG_CLIENT_API_HASH are required');
  }

  const transport = new GramJsClient({
    apiId,
    apiHash,
    sessionString,
    logger: logger.child({ component: 'gramjs', connectionId }),
  });

  await transport.connect();

  transportCache.set(connectionId, { transport, lastUsed: Date.now() });

  return transport;
}

function evictStaleEntries(): void {
  const now = Date.now();

  for (const [id, entry] of transportCache) {
    if (now - entry.lastUsed > CACHE_TTL_MS) {
      entry.transport.disconnect().catch(() => {});
      transportCache.delete(id);
    }
  }

  if (transportCache.size >= MAX_CACHE_SIZE) {
    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [id, entry] of transportCache) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestId = id;
      }
    }
    if (oldestId) {
      const entry = transportCache.get(oldestId);
      entry?.transport.disconnect().catch(() => {});
      transportCache.delete(oldestId);
    }
  }
}

/** Disconnect and clear all cached transports. */
export function clearTransportCache(): void {
  for (const [, entry] of transportCache) {
    entry.transport.disconnect().catch(() => {});
  }
  transportCache.clear();
}
