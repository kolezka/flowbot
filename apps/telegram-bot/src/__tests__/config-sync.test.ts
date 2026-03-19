import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigSyncService } from '../services/config-sync.js'
import { registerCommandsFromConfig } from '../services/command-registry.js'

function createTestLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as any
}

function createMockPrisma(overrides: any = {}) {
  return {
    botInstance: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      ...overrides.botInstance,
    },
  } as any
}

function createMockApi() {
  return {
    setMyCommands: vi.fn().mockResolvedValue(true),
  } as any
}

const BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'

describe('ConfigSyncService', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let logger: ReturnType<typeof createTestLogger>
  let service: ConfigSyncService

  beforeEach(() => {
    vi.useFakeTimers()
    logger = createTestLogger()
  })

  afterEach(() => {
    service?.stop()
    vi.useRealTimers()
  })

  it('should start with null config when no BotInstance found', async () => {
    prisma = createMockPrisma()
    service = new ConfigSyncService(prisma, BOT_TOKEN, logger)

    await service.start()

    expect(service.getConfigVersion()).toBe(0)
    expect(service.getCommands()).toEqual([])
    expect(service.getResponses()).toEqual([])
    expect(service.getMenus()).toEqual([])
    expect(logger.info).toHaveBeenCalledWith(
      'No BotInstance found in DB for this token, using code defaults',
    )
  })

  it('should load commands, responses, and menus from DB', async () => {
    prisma = createMockPrisma({
      botInstance: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'inst-1',
          configVersion: 3,
          commands: [
            { command: 'start', description: 'Start bot', isEnabled: true, sortOrder: 0 },
            { command: 'help', description: 'Get help', isEnabled: false, sortOrder: 1 },
          ],
          responses: [
            { key: 'welcome', locale: 'en', text: 'Hello!' },
            { key: 'welcome', locale: 'pl', text: 'Cześć!' },
          ],
          menus: [
            {
              name: 'main',
              buttons: [
                { label: 'Shop', action: '/shop', row: 0, col: 0 },
                { label: 'Help', action: '/help', row: 0, col: 1 },
              ],
            },
          ],
        }),
        findUnique: vi.fn().mockResolvedValue({ configVersion: 3 }),
      },
    })

    service = new ConfigSyncService(prisma, BOT_TOKEN, logger)
    await service.start()

    expect(service.getConfigVersion()).toBe(3)
    expect(service.getCommands()).toHaveLength(2)
    expect(service.getResponses()).toHaveLength(2)
    expect(service.getResponses('pl')).toHaveLength(1)
    expect(service.getResponse('welcome', 'en')).toBe('Hello!')
    expect(service.getResponse('welcome', 'pl')).toBe('Cześć!')
    expect(service.getResponse('nonexistent')).toBeNull()
    expect(service.getMenus()).toHaveLength(1)
    expect(service.getMenu('main')).toEqual({
      name: 'main',
      buttons: [
        { label: 'Shop', action: '/shop', row: 0, col: 0 },
        { label: 'Help', action: '/help', row: 0, col: 1 },
      ],
    })
    expect(service.getMenu('nonexistent')).toBeNull()
  })

  it('should allow all commands when no DB config is loaded', async () => {
    prisma = createMockPrisma()
    service = new ConfigSyncService(prisma, BOT_TOKEN, logger)
    await service.start()

    expect(service.isCommandEnabled('anything')).toBe(true)
  })

  it('should report enabled/disabled commands from DB', async () => {
    prisma = createMockPrisma({
      botInstance: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'inst-1',
          configVersion: 1,
          commands: [
            { command: 'start', description: 'Start', isEnabled: true, sortOrder: 0 },
            { command: 'admin', description: 'Admin', isEnabled: false, sortOrder: 1 },
          ],
          responses: [],
          menus: [],
        }),
        findUnique: vi.fn().mockResolvedValue({ configVersion: 1 }),
      },
    })

    service = new ConfigSyncService(prisma, BOT_TOKEN, logger)
    await service.start()

    expect(service.isCommandEnabled('start')).toBe(true)
    expect(service.isCommandEnabled('admin')).toBe(false)
    // Commands not in DB default to enabled
    expect(service.isCommandEnabled('unknown')).toBe(true)
  })

  it('should poll and detect version changes', async () => {
    let callCount = 0
    prisma = createMockPrisma({
      botInstance: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'inst-1',
          configVersion: 1,
          commands: [{ command: 'start', description: 'Start', isEnabled: true, sortOrder: 0 }],
          responses: [],
          menus: [],
        }),
        findUnique: vi.fn().mockImplementation(() => {
          callCount++
          // On second poll, return bumped version
          if (callCount >= 2) {
            return Promise.resolve({ configVersion: 2 })
          }
          return Promise.resolve({ configVersion: 1 })
        }),
      },
    })

    service = new ConfigSyncService(prisma, BOT_TOKEN, logger)
    await service.start()

    expect(service.getConfigVersion()).toBe(1)

    // Advance past poll interval (60 seconds)
    await vi.advanceTimersByTimeAsync(60_001)

    // Version check should have been called
    expect(prisma.botInstance.findUnique).toHaveBeenCalled()
  })

  it('should stop polling on stop()', async () => {
    prisma = createMockPrisma()
    service = new ConfigSyncService(prisma, BOT_TOKEN, logger)
    await service.start()

    service.stop()

    // Advancing timers should not trigger more calls
    const callCount = prisma.botInstance.findFirst.mock.calls.length
    await vi.advanceTimersByTimeAsync(120_000)
    expect(prisma.botInstance.findFirst.mock.calls.length).toBe(callCount)
  })

  it('should notify change listeners on version change', async () => {
    const listener = vi.fn()

    prisma = createMockPrisma({
      botInstance: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({
            id: 'inst-1',
            configVersion: 1,
            commands: [],
            responses: [],
            menus: [],
          })
          .mockResolvedValue({
            id: 'inst-1',
            configVersion: 2,
            commands: [{ command: 'help', description: 'Help', isEnabled: true, sortOrder: 0 }],
            responses: [],
            menus: [],
          }),
        findUnique: vi.fn().mockResolvedValue({ configVersion: 2 }),
      },
    })

    service = new ConfigSyncService(prisma, BOT_TOKEN, logger)
    service.onChange(listener)
    await service.start()

    // First load doesn't trigger listener (no previous version)
    expect(listener).not.toHaveBeenCalled()

    // Trigger poll
    await vi.advanceTimersByTimeAsync(60_001)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ configVersion: 2 }),
    )
  })

  it('should handle DB errors gracefully', async () => {
    prisma = createMockPrisma({
      botInstance: {
        findFirst: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      },
    })

    service = new ConfigSyncService(prisma, BOT_TOKEN, logger)
    await service.start()

    // Should fall back to defaults
    expect(service.getConfigVersion()).toBe(0)
    expect(service.isCommandEnabled('anything')).toBe(true)
    expect(logger.warn).toHaveBeenCalled()
  })
})

describe('registerCommandsFromConfig', () => {
  let api: ReturnType<typeof createMockApi>
  let logger: ReturnType<typeof createTestLogger>

  beforeEach(() => {
    api = createMockApi()
    logger = createTestLogger()
  })

  it('should register enabled commands with descriptions', async () => {
    const commands = [
      { command: 'start', description: 'Start the bot', isEnabled: true, sortOrder: 0 },
      { command: 'help', description: 'Get help', isEnabled: true, sortOrder: 1 },
      { command: 'admin', description: 'Admin panel', isEnabled: false, sortOrder: 2 },
    ]

    await registerCommandsFromConfig(api, commands, logger)

    expect(api.setMyCommands).toHaveBeenCalledWith([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Get help' },
    ])
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ count: 2 }),
      expect.any(String),
    )
  })

  it('should skip commands without descriptions', async () => {
    const commands = [
      { command: 'start', description: null, isEnabled: true, sortOrder: 0 },
      { command: 'help', description: 'Get help', isEnabled: true, sortOrder: 1 },
    ]

    await registerCommandsFromConfig(api, commands, logger)

    expect(api.setMyCommands).toHaveBeenCalledWith([
      { command: 'help', description: 'Get help' },
    ])
  })

  it('should not call setMyCommands when no enabled commands exist', async () => {
    await registerCommandsFromConfig(api, [], logger)

    expect(api.setMyCommands).not.toHaveBeenCalled()
    expect(logger.debug).toHaveBeenCalled()
  })

  it('should handle API errors gracefully', async () => {
    api.setMyCommands.mockRejectedValue(new Error('Telegram API error'))
    const commands = [
      { command: 'start', description: 'Start', isEnabled: true, sortOrder: 0 },
    ]

    await registerCommandsFromConfig(api, commands, logger)

    expect(logger.warn).toHaveBeenCalled()
  })

  it('should respect sort order', async () => {
    const commands = [
      { command: 'help', description: 'Help', isEnabled: true, sortOrder: 2 },
      { command: 'start', description: 'Start', isEnabled: true, sortOrder: 0 },
      { command: 'settings', description: 'Settings', isEnabled: true, sortOrder: 1 },
    ]

    await registerCommandsFromConfig(api, commands, logger)

    expect(api.setMyCommands).toHaveBeenCalledWith([
      { command: 'start', description: 'Start' },
      { command: 'settings', description: 'Settings' },
      { command: 'help', description: 'Help' },
    ])
  })
})
