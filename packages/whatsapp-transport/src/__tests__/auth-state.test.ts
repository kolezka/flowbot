import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDbAuthState } from '../transport/auth-state.js'

const mockPrisma = {
  platformConnection: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

describe('createDbAuthState', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('loads creds from PlatformConnection.credentials', async () => {
    mockPrisma.platformConnection.findUnique.mockResolvedValue({
      credentials: { creds: { me: { id: '123' } }, keys: {} },
    })
    const { state } = await createDbAuthState('conn-id', mockPrisma as any)
    expect(state.creds.me).toEqual({ id: '123' })
  })

  it('returns empty creds when no connection found', async () => {
    mockPrisma.platformConnection.findUnique.mockResolvedValue(null)
    const { state } = await createDbAuthState('conn-id', mockPrisma as any)
    expect(state.creds).toEqual({})
  })

  it('saveCreds writes back to DB', async () => {
    mockPrisma.platformConnection.findUnique.mockResolvedValue({
      credentials: { creds: {}, keys: {} },
    })
    mockPrisma.platformConnection.update.mockResolvedValue({})
    const { state, saveCreds } = await createDbAuthState('conn-id', mockPrisma as any)
    state.creds = { me: { id: '456' } } as any
    await saveCreds()
    expect(mockPrisma.platformConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-id' },
      data: expect.objectContaining({
        credentials: expect.objectContaining({
          creds: expect.objectContaining({ me: { id: '456' } }),
        }),
      }),
    })
  })

  it('keys.set persists signal keys', async () => {
    mockPrisma.platformConnection.findUnique.mockResolvedValue({
      credentials: { creds: {}, keys: {} },
    })
    mockPrisma.platformConnection.update.mockResolvedValue({})
    const { state } = await createDbAuthState('conn-id', mockPrisma as any)
    await state.keys.set({ 'pre-key': { '1': 'key-data' } })
    expect(mockPrisma.platformConnection.update).toHaveBeenCalled()
  })

  it('keys.get returns values for matching ids', async () => {
    mockPrisma.platformConnection.findUnique.mockResolvedValue({
      credentials: { creds: {}, keys: { 'session': { 'abc': 'session-data' } } },
    })
    const { state } = await createDbAuthState('conn-id', mockPrisma as any)
    const result = await state.keys.get('session', ['abc', 'missing'])
    expect(result).toEqual({ abc: 'session-data' })
  })

  it('keys.get returns empty object for unknown type', async () => {
    mockPrisma.platformConnection.findUnique.mockResolvedValue({
      credentials: { creds: {}, keys: {} },
    })
    const { state } = await createDbAuthState('conn-id', mockPrisma as any)
    const result = await state.keys.get('unknown-type', ['id1'])
    expect(result).toEqual({})
  })

  it('keys.set merges with existing keys of same type', async () => {
    mockPrisma.platformConnection.findUnique.mockResolvedValue({
      credentials: { creds: {}, keys: { 'pre-key': { '1': 'existing' } } },
    })
    mockPrisma.platformConnection.update.mockResolvedValue({})
    const { state } = await createDbAuthState('conn-id', mockPrisma as any)
    await state.keys.set({ 'pre-key': { '2': 'new-key' } })
    expect(mockPrisma.platformConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-id' },
      data: expect.objectContaining({
        credentials: expect.objectContaining({
          keys: expect.objectContaining({
            'pre-key': { '1': 'existing', '2': 'new-key' },
          }),
        }),
      }),
    })
  })
})
