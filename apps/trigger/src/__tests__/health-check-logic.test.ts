import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('../lib/telegram-bot.js', () => ({
  checkTelegramBotHealth: vi.fn(),
}))

vi.mock('@trigger.dev/sdk/v3', () => ({
  schedules: { task: (opts: any) => opts },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { healthCheckTask } = await import('../trigger/health-check.js') as any
import { getPrisma } from '../lib/prisma.js'
import { checkTelegramBotHealth } from '../lib/telegram-bot.js'

function createMockPrisma() {
  return {
    $queryRaw: vi.fn(),
  }
}

describe('health-check task logic', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.mocked(getPrisma).mockReturnValue(mockPrisma as any)
  })

  it('should report all healthy when everything is up', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    vi.mocked(checkTelegramBotHealth).mockResolvedValue(true)

    const result = await healthCheckTask.run()

    expect(result.overall).toBe('up')
    expect(result.components.database.status).toBe('up')
    expect(result.components.database.latencyMs).toBeTypeOf('number')
    expect(result.components.managerBot.status).toBe('up')
    expect(result.components.managerBot.latencyMs).toBeTypeOf('number')
    expect(result.checkedAt).toBeDefined()
  })

  it('should report down when database is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'))
    vi.mocked(checkTelegramBotHealth).mockResolvedValue(true)

    const result = await healthCheckTask.run()

    expect(result.overall).toBe('down')
    expect(result.components.database.status).toBe('down')
    expect(result.components.database.error).toBe('Connection refused')
    expect(result.components.managerBot.status).toBe('up')
  })

  it('should report degraded when telegram-bot is unreachable', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    vi.mocked(checkTelegramBotHealth).mockResolvedValue(false)

    const result = await healthCheckTask.run()

    expect(result.overall).toBe('degraded')
    expect(result.components.database.status).toBe('up')
    expect(result.components.managerBot.status).toBe('unreachable')
  })

  it('should report down when database is down and telegram-bot is unreachable', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('DB gone'))
    vi.mocked(checkTelegramBotHealth).mockResolvedValue(false)

    const result = await healthCheckTask.run()

    expect(result.overall).toBe('down')
    expect(result.components.database.status).toBe('down')
    expect(result.components.managerBot.status).toBe('unreachable')
  })

  it('should handle non-Error thrown from database', async () => {
    mockPrisma.$queryRaw.mockRejectedValue('string error')
    vi.mocked(checkTelegramBotHealth).mockResolvedValue(true)

    const result = await healthCheckTask.run()

    expect(result.overall).toBe('down')
    expect(result.components.database.status).toBe('down')
    expect(result.components.database.error).toBe('Unknown error')
  })

  it('should include latency measurements for all components', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    vi.mocked(checkTelegramBotHealth).mockResolvedValue(true)

    const result = await healthCheckTask.run()

    expect(result.components.database.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.components.managerBot.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('should include ISO timestamp in checkedAt', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    vi.mocked(checkTelegramBotHealth).mockResolvedValue(true)

    const result = await healthCheckTask.run()

    expect(() => new Date(result.checkedAt)).not.toThrow()
    expect(new Date(result.checkedAt).toISOString()).toBe(result.checkedAt)
  })
})
