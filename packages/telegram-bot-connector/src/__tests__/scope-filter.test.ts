import { describe, it, expect } from 'vitest'
import { shouldProcessMessage } from '../scope-filter.js'

describe('shouldProcessMessage', () => {
  it('should process all messages when no scope set', () => {
    expect(shouldProcessMessage(undefined, 'chat-1', 'user-1')).toBe(true)
  })

  it('should process all messages when scope is empty', () => {
    expect(shouldProcessMessage({}, 'chat-1', 'user-1')).toBe(true)
  })

  it('should process all messages when arrays are empty', () => {
    expect(shouldProcessMessage({ groupIds: [], userIds: [] }, 'chat-1', 'user-1')).toBe(true)
  })

  it('should allow message from scoped group', () => {
    expect(shouldProcessMessage({ groupIds: ['chat-1'] }, 'chat-1', 'user-1')).toBe(true)
  })

  it('should allow message from scoped user', () => {
    expect(shouldProcessMessage({ userIds: ['user-1'] }, 'chat-2', 'user-1')).toBe(true)
  })

  it('should reject message not matching any scope', () => {
    expect(shouldProcessMessage({ groupIds: ['chat-1'], userIds: ['user-1'] }, 'chat-2', 'user-2')).toBe(false)
  })

  it('should allow if group matches even if user does not', () => {
    expect(shouldProcessMessage({ groupIds: ['chat-1'], userIds: ['user-1'] }, 'chat-1', 'user-2')).toBe(true)
  })

  it('should allow if user matches even if group does not', () => {
    expect(shouldProcessMessage({ groupIds: ['chat-1'], userIds: ['user-1'] }, 'chat-2', 'user-1')).toBe(true)
  })
})
