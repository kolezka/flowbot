import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventForwarder } from '../event-forwarder.js'
import type { Logger } from 'pino'

const mockLogger = {
  child: () => mockLogger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger

describe('EventForwarder', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => { originalFetch = globalThis.fetch })
  afterEach(() => { globalThis.fetch = originalFetch })

  it('POSTs event to API webhook URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = mockFetch

    const forwarder = new EventForwarder({ apiUrl: 'http://api:3000', logger: mockLogger })
    await forwarder.send({ platform: 'whatsapp', eventType: 'message_received', data: { text: 'hi' } })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://api:3000/api/flow/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      }),
    )
  })

  it('logs warning on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 })
    const forwarder = new EventForwarder({ apiUrl: 'http://api:3000', logger: mockLogger })
    await forwarder.send({ platform: 'test', eventType: 'test' })
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  it('logs error on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'))
    const forwarder = new EventForwarder({ apiUrl: 'http://api:3000', logger: mockLogger })
    await forwarder.send({ platform: 'test', eventType: 'test' })
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('does not throw on failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const forwarder = new EventForwarder({ apiUrl: 'http://api:3000', logger: mockLogger })
    await expect(forwarder.send({ platform: 'test', eventType: 'test' })).resolves.toBeUndefined()
  })
})
