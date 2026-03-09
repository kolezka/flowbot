import { describe, expect, it } from 'vitest'
import { FloodError, RPCError } from 'telegram/errors'
import { classifyError, ErrorCategory } from '../errors/classifier.js'

// Helper to create an RPCError with a given errorMessage and code
function makeRPCError(errorMessage: string, code?: number): RPCError {
  return new RPCError(errorMessage, { className: 'TestRequest' } as any, code)
}

// Helper to create a FloodError
function makeFloodError(): FloodError {
  // FloodError extends RPCError; constructor uses super(...arguments)
  // and sets code=420, errorMessage='FLOOD'
  return new FloodError('FLOOD_WAIT_5', { className: 'TestRequest' } as any, 420)
}

describe('classifyError', () => {
  describe('RATE_LIMITED', () => {
    it('classifies FloodError as RATE_LIMITED', () => {
      const error = makeFloodError()
      expect(classifyError(error)).toBe(ErrorCategory.RATE_LIMITED)
    })

    it('classifies RPCError with FLOOD_WAIT message as RATE_LIMITED', () => {
      const error = makeRPCError('FLOOD_WAIT_30', 420)
      expect(classifyError(error)).toBe(ErrorCategory.RATE_LIMITED)
    })

    it('classifies RPCError with code 420 as RATE_LIMITED', () => {
      const error = makeRPCError('SOME_FLOOD', 420)
      expect(classifyError(error)).toBe(ErrorCategory.RATE_LIMITED)
    })
  })

  describe('AUTH_EXPIRED', () => {
    const authMessages = [
      'AUTH_KEY_UNREGISTERED',
      'SESSION_REVOKED',
      'USER_DEACTIVATED',
      'USER_DEACTIVATED_BAN',
      'SESSION_EXPIRED',
    ]

    for (const msg of authMessages) {
      it(`classifies RPCError "${msg}" as AUTH_EXPIRED`, () => {
        const error = makeRPCError(msg, 401)
        expect(classifyError(error)).toBe(ErrorCategory.AUTH_EXPIRED)
      })
    }
  })

  describe('FATAL', () => {
    const fatalMessages = [
      'AUTH_KEY_DUPLICATED',
      'INPUT_USER_DEACTIVATED',
      'CHAT_WRITE_FORBIDDEN',
      'CHANNEL_PRIVATE',
      'CHANNEL_INVALID',
      'USER_BANNED_IN_CHANNEL',
      'CHAT_ADMIN_REQUIRED',
      'USER_NOT_PARTICIPANT',
    ]

    for (const msg of fatalMessages) {
      it(`classifies RPCError "${msg}" as FATAL`, () => {
        const error = makeRPCError(msg, 400)
        expect(classifyError(error)).toBe(ErrorCategory.FATAL)
      })
    }
  })

  describe('RETRYABLE', () => {
    it('classifies unknown RPCError as RETRYABLE', () => {
      const error = makeRPCError('SOME_UNKNOWN_ERROR', 500)
      expect(classifyError(error)).toBe(ErrorCategory.RETRYABLE)
    })

    it('classifies generic Error as RETRYABLE', () => {
      const error = new Error('network timeout')
      expect(classifyError(error)).toBe(ErrorCategory.RETRYABLE)
    })

    it('classifies non-Error value (string) as RETRYABLE', () => {
      expect(classifyError('something went wrong')).toBe(ErrorCategory.RETRYABLE)
    })

    it('classifies non-Error value (null) as RETRYABLE', () => {
      expect(classifyError(null)).toBe(ErrorCategory.RETRYABLE)
    })

    it('classifies non-Error value (undefined) as RETRYABLE', () => {
      expect(classifyError(undefined)).toBe(ErrorCategory.RETRYABLE)
    })

    it('classifies non-Error value (number) as RETRYABLE', () => {
      expect(classifyError(42)).toBe(ErrorCategory.RETRYABLE)
    })
  })
})
