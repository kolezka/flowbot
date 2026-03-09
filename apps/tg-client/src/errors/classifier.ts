import { FloodError, RPCError } from 'telegram/errors'

export enum ErrorCategory {
  FATAL = 'FATAL',
  RATE_LIMITED = 'RATE_LIMITED',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  RETRYABLE = 'RETRYABLE',
}

const AUTH_EXPIRED_MESSAGES = new Set([
  'AUTH_KEY_UNREGISTERED',
  'SESSION_REVOKED',
  'USER_DEACTIVATED',
  'USER_DEACTIVATED_BAN',
  'SESSION_EXPIRED',
])

const FATAL_MESSAGES = new Set([
  'AUTH_KEY_DUPLICATED',
  'INPUT_USER_DEACTIVATED',
  'CHAT_WRITE_FORBIDDEN',
  'CHANNEL_PRIVATE',
  'CHANNEL_INVALID',
  'USER_BANNED_IN_CHANNEL',
  'CHAT_ADMIN_REQUIRED',
  'USER_NOT_PARTICIPANT',
])

export function classifyError(error: unknown): ErrorCategory {
  if (error instanceof FloodError) {
    return ErrorCategory.RATE_LIMITED
  }

  if (error instanceof RPCError) {
    const msg = error.errorMessage

    if (msg.startsWith('FLOOD_WAIT') || error.code === 420) {
      return ErrorCategory.RATE_LIMITED
    }

    if (AUTH_EXPIRED_MESSAGES.has(msg)) {
      return ErrorCategory.AUTH_EXPIRED
    }

    if (FATAL_MESSAGES.has(msg)) {
      return ErrorCategory.FATAL
    }
  }

  return ErrorCategory.RETRYABLE
}
