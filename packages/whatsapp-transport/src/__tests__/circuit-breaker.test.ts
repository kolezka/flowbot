import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CircuitBreaker, CircuitState, CircuitOpenError } from '../transport/CircuitBreaker.js'
import { FakeWhatsAppTransport } from '../transport/FakeWhatsAppTransport.js'
import type { Logger } from 'pino'

const mockLogger = {
  child: () => mockLogger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger

describe('CircuitBreaker', () => {
  let transport: FakeWhatsAppTransport
  let breaker: CircuitBreaker

  beforeEach(() => {
    transport = new FakeWhatsAppTransport()
    breaker = new CircuitBreaker(transport, { failureThreshold: 2, resetTimeoutMs: 100, windowMs: 1000 }, mockLogger)
  })

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('delegates calls to underlying transport', async () => {
    await breaker.connect()
    const result = await breaker.sendMessage('123@s.whatsapp.net', 'hello')
    expect(result.key.remoteJid).toBe('123@s.whatsapp.net')
  })

  it('opens after failure threshold', async () => {
    const failing = new FakeWhatsAppTransport()
    failing.sendMessage = vi.fn().mockRejectedValue(new Error('fail'))
    const failBreaker = new CircuitBreaker(failing, { failureThreshold: 2, resetTimeoutMs: 100, windowMs: 1000 }, mockLogger)

    await expect(failBreaker.sendMessage('x', 'a')).rejects.toThrow('fail')
    await expect(failBreaker.sendMessage('x', 'b')).rejects.toThrow('fail')
    expect(failBreaker.getState()).toBe(CircuitState.OPEN)
    await expect(failBreaker.sendMessage('x', 'c')).rejects.toThrow(CircuitOpenError)
  })

  it('passes through connect/disconnect/isConnected without circuit logic', async () => {
    expect(breaker.isConnected()).toBe(false)
    await breaker.connect()
    expect(breaker.isConnected()).toBe(true)
    await breaker.disconnect()
    expect(breaker.isConnected()).toBe(false)
  })

  it('passes through onQrCode callback', () => {
    const cb = vi.fn()
    breaker.onQrCode(cb)
    transport.emitQr('qr-code-data')
    expect(cb).toHaveBeenCalledWith('qr-code-data')
  })

  it('passes through onConnectionUpdate callback', () => {
    const cb = vi.fn()
    breaker.onConnectionUpdate(cb)
    transport.emitConnectionUpdate({ connection: 'open' })
    expect(cb).toHaveBeenCalledWith({ connection: 'open' })
  })

  it('passes through getClient', () => {
    expect(breaker.getClient()).toBeNull()
  })

  it('transitions to HALF_OPEN after resetTimeoutMs and closes on success', async () => {
    const failing = new FakeWhatsAppTransport()
    failing.sendMessage = vi.fn().mockRejectedValue(new Error('fail'))
    const failBreaker = new CircuitBreaker(failing, { failureThreshold: 2, resetTimeoutMs: 50, windowMs: 1000 }, mockLogger)

    await expect(failBreaker.sendMessage('x', 'a')).rejects.toThrow('fail')
    await expect(failBreaker.sendMessage('x', 'b')).rejects.toThrow('fail')
    expect(failBreaker.getState()).toBe(CircuitState.OPEN)

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 60))

    // Restore the transport so the probe succeeds
    failing.sendMessage = vi.fn().mockResolvedValue({ key: { remoteJid: 'x', fromMe: true, id: 'probe-1' }, status: 'sent' as const })

    const result = await failBreaker.sendMessage('x', 'probe')
    expect(result.status).toBe('sent')
    expect(failBreaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('re-opens from HALF_OPEN if probe fails', async () => {
    const failing = new FakeWhatsAppTransport()
    failing.sendMessage = vi.fn().mockRejectedValue(new Error('fail'))
    const failBreaker = new CircuitBreaker(failing, { failureThreshold: 2, resetTimeoutMs: 50, windowMs: 1000 }, mockLogger)

    await expect(failBreaker.sendMessage('x', 'a')).rejects.toThrow('fail')
    await expect(failBreaker.sendMessage('x', 'b')).rejects.toThrow('fail')
    expect(failBreaker.getState()).toBe(CircuitState.OPEN)

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 60))

    // Probe still fails
    await expect(failBreaker.sendMessage('x', 'probe')).rejects.toThrow('fail')
    expect(failBreaker.getState()).toBe(CircuitState.OPEN)
  })

  it('delegates sendMedia through circuit', async () => {
    const result = await breaker.sendMedia('jid@s.whatsapp.net', 'image', 'http://example.com/img.jpg')
    expect(result.key.remoteJid).toBe('jid@s.whatsapp.net')
  })

  it('delegates group admin methods through circuit', async () => {
    const kicked = await breaker.kickParticipant('group@g.us', 'user@s.whatsapp.net')
    expect(kicked).toBe(true)

    const meta = await breaker.getGroupMetadata('group@g.us')
    expect(meta.id).toBe('group@g.us')

    const link = await breaker.getGroupInviteLink('group@g.us')
    expect(link).toContain('group@g.us')
  })

  it('does not count successful calls as failures', async () => {
    for (let i = 0; i < 10; i++) {
      await breaker.sendMessage('jid@s.whatsapp.net', `msg ${i}`)
    }
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })
})
