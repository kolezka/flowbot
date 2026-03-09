import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import pino from 'pino'
import { CircuitBreaker, CircuitOpenError, CircuitState } from '../transport/CircuitBreaker.js'
import { FakeTelegramTransport } from '../transport/FakeTelegramTransport.js'
import type { Logger } from '../logger.js'

const logger = pino({ level: 'silent' }) as unknown as Logger

describe('CircuitBreaker', () => {
  let transport: FakeTelegramTransport
  let breaker: CircuitBreaker

  beforeEach(() => {
    transport = new FakeTelegramTransport()
    breaker = new CircuitBreaker(transport, {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      windowMs: 5000,
    }, logger)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('delegates connect/disconnect/isConnected to transport', async () => {
    expect(breaker.isConnected()).toBe(false)
    await breaker.connect()
    expect(breaker.isConnected()).toBe(true)
    await breaker.disconnect()
    expect(breaker.isConnected()).toBe(false)
  })

  it('passes through successful calls in CLOSED state', async () => {
    const result = await breaker.sendMessage('peer1', 'hello')
    expect(result.id).toBe(1)
    expect(result.peerId).toBe('peer1')
    expect(transport.getSentMessages()).toHaveLength(1)
  })

  it('opens after threshold failures within window', async () => {
    // Make the transport throw on sendMessage
    const error = new Error('connection failed')
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(error)

    for (let i = 0; i < 3; i++) {
      await expect(breaker.sendMessage('peer', 'text')).rejects.toThrow('connection failed')
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('rejects calls when OPEN with CircuitOpenError', async () => {
    const error = new Error('fail')
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(error)

    // Trip the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.sendMessage('peer', 'text')).rejects.toThrow()
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Next call should be rejected immediately
    await expect(breaker.sendMessage('peer', 'text')).rejects.toThrow(CircuitOpenError)
  })

  it('transitions to HALF_OPEN after resetTimeout', async () => {
    const error = new Error('fail')
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(error)

    // Trip the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.sendMessage('peer', 'text')).rejects.toThrow()
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Advance time past resetTimeoutMs
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1500)

    // Restore transport to succeed
    vi.spyOn(transport, 'sendMessage').mockRestore()

    // This call should transition to HALF_OPEN and succeed (probe)
    const result = await breaker.sendMessage('peer', 'hello after reset')
    expect(result).toBeDefined()
    // After successful probe, should be CLOSED
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('closes on successful probe in HALF_OPEN state', async () => {
    const error = new Error('fail')
    const sendSpy = vi.spyOn(transport, 'sendMessage').mockRejectedValue(error)

    // Trip the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.sendMessage('peer', 'text')).rejects.toThrow()
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Advance time
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1500)

    // Make transport succeed for probe
    sendSpy.mockRestore()

    const result = await breaker.sendMessage('peer', 'probe')
    expect(result).toBeDefined()
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('re-opens on failed probe in HALF_OPEN state', async () => {
    const error = new Error('fail')
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(error)

    // Trip the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.sendMessage('peer', 'text')).rejects.toThrow()
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Advance time past resetTimeout
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1500)

    // Transport still fails - probe should fail and re-open
    await expect(breaker.sendMessage('peer', 'probe')).rejects.toThrow('fail')
    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('works with forwardMessage', async () => {
    const results = await breaker.forwardMessage('from', 'to', [1, 2, 3])
    expect(results).toHaveLength(3)
    expect(transport.getForwardedMessages()).toHaveLength(1)
  })

  it('works with resolveUsername', async () => {
    const peer = await breaker.resolveUsername('testuser')
    expect(peer.type).toBe('user')
    expect(peer.id).toBe(BigInt(8000))
  })
})
