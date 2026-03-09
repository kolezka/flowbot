import { describe, expect, it } from 'vitest'
import { AntiSpamService } from '../services/anti-spam.js'

describe('AntiSpamService', () => {
  describe('flood detection', () => {
    it('returns clean when under the limit', () => {
      const service = new AntiSpamService()
      const result = service.checkMessage('chat1', 'user1', 'hello', 5, 10)
      expect(result).toBe('clean')
    })

    it('detects flood when messages exceed limit', () => {
      const service = new AntiSpamService()
      const maxMessages = 3
      const windowSeconds = 10

      // Send messages up to the limit — should be clean
      for (let i = 0; i < maxMessages; i++) {
        const result = service.checkMessage('chat1', 'user1', `msg ${i}`, maxMessages, windowSeconds)
        expect(result).toBe('clean')
      }

      // Next message exceeds the limit
      const result = service.checkMessage('chat1', 'user1', 'one more', maxMessages, windowSeconds)
      expect(result).toBe('flood')
    })

    it('tracks users independently', () => {
      const service = new AntiSpamService()
      service.checkMessage('chat1', 'user1', 'hello', 2, 10)
      service.checkMessage('chat1', 'user1', 'world', 2, 10)

      // user2 should still be clean
      const result = service.checkMessage('chat1', 'user2', 'hello', 2, 10)
      expect(result).toBe('clean')
    })

    it('tracks groups independently', () => {
      const service = new AntiSpamService()
      service.checkMessage('chat1', 'user1', 'hello', 2, 10)
      service.checkMessage('chat1', 'user1', 'world', 2, 10)

      // same user in a different group should be clean
      const result = service.checkMessage('chat2', 'user1', 'hello', 2, 10)
      expect(result).toBe('clean')
    })
  })

  describe('duplicate detection', () => {
    it('detects duplicate messages (3 identical within 60s)', () => {
      const service = new AntiSpamService()
      const text = 'buy my product now'

      // First two are clean
      expect(service.checkMessage('chat1', 'user1', text, 100, 60)).toBe('clean')
      expect(service.checkMessage('chat1', 'user1', text, 100, 60)).toBe('clean')

      // Third identical message triggers duplicate
      expect(service.checkMessage('chat1', 'user1', text, 100, 60)).toBe('duplicate')
    })

    it('normalizes whitespace and case for duplicate detection', () => {
      const service = new AntiSpamService()

      expect(service.checkMessage('chat1', 'user1', 'Hello World', 100, 60)).toBe('clean')
      expect(service.checkMessage('chat1', 'user1', 'hello   world', 100, 60)).toBe('clean')
      expect(service.checkMessage('chat1', 'user1', 'HELLO WORLD', 100, 60)).toBe('duplicate')
    })

    it('does not flag different messages as duplicates', () => {
      const service = new AntiSpamService()

      expect(service.checkMessage('chat1', 'user1', 'message one', 100, 60)).toBe('clean')
      expect(service.checkMessage('chat1', 'user1', 'message two', 100, 60)).toBe('clean')
      expect(service.checkMessage('chat1', 'user1', 'message three', 100, 60)).toBe('clean')
    })
  })

  describe('flood takes priority over duplicate', () => {
    it('returns flood before checking duplicates', () => {
      const service = new AntiSpamService()
      const text = 'spam spam'

      // Send identical messages, but with a low flood limit
      expect(service.checkMessage('chat1', 'user1', text, 2, 60)).toBe('clean')
      expect(service.checkMessage('chat1', 'user1', text, 2, 60)).toBe('clean')

      // Third message: flood limit (2) exceeded, so flood takes priority
      expect(service.checkMessage('chat1', 'user1', text, 2, 60)).toBe('flood')
    })
  })
})
