import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FlowEventForwarder } from '../services/flow-events.js'

// Mock @trigger.dev/sdk/v3
vi.mock('@trigger.dev/sdk/v3', () => ({
  tasks: {
    trigger: vi.fn().mockResolvedValue({ id: 'run-123' }),
  },
}))

import { tasks } from '@trigger.dev/sdk/v3'

function createTestLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as any
}

function createMockPrisma(flows: any[] = []) {
  return {
    flowDefinition: {
      findMany: vi.fn().mockResolvedValue(flows),
    },
  } as any
}

function makeFlow(id: string, triggerType: string, status = 'active') {
  return {
    id,
    nodesJson: [
      { id: 'trigger-1', type: triggerType, category: 'trigger', label: 'Trigger', config: {} },
      { id: 'action-1', type: 'send_message', category: 'action', label: 'Action', config: {} },
    ],
    status,
  }
}

describe('FlowEventForwarder', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let logger: ReturnType<typeof createTestLogger>
  let forwarder: FlowEventForwarder

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('findMatchingFlows', () => {
    it('finds flows with matching trigger type', async () => {
      prisma = createMockPrisma([
        makeFlow('flow-1', 'message_received'),
        makeFlow('flow-2', 'user_joins'),
      ])
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      const matches = await forwarder.findMatchingFlows('message_received')

      expect(matches).toHaveLength(1)
      expect(matches[0]).toEqual({ flowId: 'flow-1', triggerType: 'message_received' })
    })

    it('returns empty array when no flows match', async () => {
      prisma = createMockPrisma([
        makeFlow('flow-1', 'schedule'),
      ])
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      const matches = await forwarder.findMatchingFlows('message_received')

      expect(matches).toHaveLength(0)
    })

    it('returns multiple matches when several flows have same trigger', async () => {
      prisma = createMockPrisma([
        makeFlow('flow-1', 'user_joins'),
        makeFlow('flow-2', 'user_joins'),
        makeFlow('flow-3', 'message_received'),
      ])
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      const matches = await forwarder.findMatchingFlows('user_joins')

      expect(matches).toHaveLength(2)
      expect(matches.map(m => m.flowId)).toEqual(['flow-1', 'flow-2'])
    })

    it('only queries active flows', async () => {
      prisma = createMockPrisma([])
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      await forwarder.findMatchingFlows('message_received')

      expect(prisma.flowDefinition.findMany).toHaveBeenCalledWith({
        where: { status: 'active' },
        select: { id: true, nodesJson: true },
      })
    })

    it('handles flows with invalid nodesJson gracefully', async () => {
      prisma = createMockPrisma([
        { id: 'flow-bad', nodesJson: 'not-an-array' },
        makeFlow('flow-good', 'message_received'),
      ])
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      const matches = await forwarder.findMatchingFlows('message_received')

      expect(matches).toHaveLength(1)
      expect(matches[0]!.flowId).toBe('flow-good')
    })
  })

  describe('onMessage', () => {
    it('triggers flow-execution for matching flows', async () => {
      prisma = createMockPrisma([
        makeFlow('flow-msg-1', 'message_received'),
      ])
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      await forwarder.onMessage(BigInt(-1001234), BigInt(5678), 'Hello world', 42)

      expect(tasks.trigger).toHaveBeenCalledWith('flow-execution', {
        flowId: 'flow-msg-1',
        triggerData: {
          type: 'message_received',
          chatId: '-1001234',
          userId: '5678',
          text: 'Hello world',
          messageId: 42,
          timestamp: expect.any(String),
        },
      })
    })

    it('does not trigger when no flows match', async () => {
      prisma = createMockPrisma([])
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      await forwarder.onMessage(BigInt(-1001234), BigInt(5678), 'Hello', 1)

      expect(tasks.trigger).not.toHaveBeenCalled()
    })

    it('triggers multiple flows when several match', async () => {
      prisma = createMockPrisma([
        makeFlow('flow-1', 'message_received'),
        makeFlow('flow-2', 'message_received'),
      ])
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      await forwarder.onMessage(BigInt(-1001234), BigInt(5678), 'Test', 10)

      expect(tasks.trigger).toHaveBeenCalledTimes(2)
    })

    it('logs error and continues when one flow trigger fails', async () => {
      prisma = createMockPrisma([
        makeFlow('flow-1', 'message_received'),
        makeFlow('flow-2', 'message_received'),
      ])
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      const triggerMock = vi.mocked(tasks.trigger)
      triggerMock.mockRejectedValueOnce(new Error('Trigger.dev unavailable'))
      triggerMock.mockResolvedValueOnce({ id: 'run-456' } as any)

      await forwarder.onMessage(BigInt(-1001234), BigInt(5678), 'Test', 10)

      expect(logger.error).toHaveBeenCalledTimes(1)
      expect(tasks.trigger).toHaveBeenCalledTimes(2)
    })
  })

  describe('onUserJoin', () => {
    it('triggers flow-execution for matching flows', async () => {
      prisma = createMockPrisma([
        makeFlow('flow-join-1', 'user_joins'),
      ])
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      await forwarder.onUserJoin(BigInt(-1001234), BigInt(9999), 'testuser')

      expect(tasks.trigger).toHaveBeenCalledWith('flow-execution', {
        flowId: 'flow-join-1',
        triggerData: {
          type: 'user_joins',
          chatId: '-1001234',
          userId: '9999',
          userName: 'testuser',
          timestamp: expect.any(String),
        },
      })
    })

    it('uses empty string for missing username', async () => {
      prisma = createMockPrisma([
        makeFlow('flow-join-1', 'user_joins'),
      ])
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      await forwarder.onUserJoin(BigInt(-1001234), BigInt(9999))

      expect(tasks.trigger).toHaveBeenCalledWith('flow-execution', expect.objectContaining({
        triggerData: expect.objectContaining({
          userName: '',
        }),
      }))
    })

    it('does not trigger when no flows match', async () => {
      prisma = createMockPrisma([
        makeFlow('flow-1', 'message_received'),
      ])
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      await forwarder.onUserJoin(BigInt(-1001234), BigInt(9999))

      expect(tasks.trigger).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('catches and logs database errors without throwing', async () => {
      prisma = createMockPrisma()
      prisma.flowDefinition.findMany.mockRejectedValue(new Error('DB connection lost'))
      logger = createTestLogger()
      forwarder = new FlowEventForwarder(prisma, logger)

      // Should not throw
      await forwarder.onMessage(BigInt(-1001234), BigInt(5678), 'Test', 1)

      expect(logger.error).toHaveBeenCalled()
      expect(tasks.trigger).not.toHaveBeenCalled()
    })
  })
})
