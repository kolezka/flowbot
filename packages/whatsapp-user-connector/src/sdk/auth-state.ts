import baileys from '@whiskeysockets/baileys'
const { initAuthCreds } = baileys

export interface AuthStateKeys {
  get(type: string, ids: string[]): Promise<Record<string, unknown>>
  set(data: Record<string, Record<string, unknown>>): Promise<void>
}

export interface AuthState {
  creds: Record<string, unknown>
  keys: AuthStateKeys
}

export interface DbAuthStateResult {
  state: AuthState
  saveCreds: () => Promise<void>
}

/** Duck-typed Prisma interface to avoid importing @flowbot/db (rootDir issues). */
interface PrismaLike {
  platformConnection: {
    findUnique(args: { where: { id: string }; select: { credentials: true } }): Promise<{ credentials: unknown } | null>
    update(args: { where: { id: string }; data: { credentials: unknown } }): Promise<unknown>
  }
}

export async function createDbAuthState(
  connectionId: string,
  prisma: PrismaLike,
): Promise<DbAuthStateResult> {
  const record = await prisma.platformConnection.findUnique({
    where: { id: connectionId },
    select: { credentials: true },
  })

  const stored = record?.credentials as { creds?: Record<string, unknown>; keys?: Record<string, Record<string, unknown>> } | null | undefined
  // Use stored creds or generate fresh ones (required for Baileys handshake + QR)
  const creds: Record<string, unknown> = (stored?.creds && Object.keys(stored.creds).length > 0)
    ? stored.creds
    : initAuthCreds()
  const keyStore: Record<string, Record<string, unknown>> = stored?.keys ?? {}

  const persistKeys = async (): Promise<void> => {
    await prisma.platformConnection.update({
      where: { id: connectionId },
      data: {
        credentials: {
          creds: state.creds,
          keys: keyStore,
        },
      },
    })
  }

  const state: AuthState = {
    creds,
    keys: {
      async get(type: string, ids: string[]): Promise<Record<string, unknown>> {
        const typeStore = keyStore[type] ?? {}
        return Object.fromEntries(
          ids
            .filter((id) => id in typeStore)
            .map((id) => [id, typeStore[id]] as [string, unknown]),
        )
      },

      async set(data: Record<string, Record<string, unknown>>): Promise<void> {
        for (const [type, typeData] of Object.entries(data)) {
          const existing = keyStore[type] ?? {}
          keyStore[type] = { ...existing, ...typeData }
        }
        await persistKeys()
      },
    },
  }

  const saveCreds = async (): Promise<void> => {
    await prisma.platformConnection.update({
      where: { id: connectionId },
      data: {
        credentials: {
          creds: state.creds,
          keys: keyStore,
        },
      },
    })
  }

  return { state, saveCreds }
}
