import { describe, it, expect } from 'vitest'
import { matchTriggers, type TriggerEntry } from '../bot/middlewares/flow-trigger.js'

describe('matchTriggers', () => {
  const registry: TriggerEntry[] = [
    { flowId: 'flow-1', nodeType: 'command_received', config: { command: '/start' }, platform: 'telegram' },
    { flowId: 'flow-2', nodeType: 'keyword_match', config: { keywords: ['help', 'support'], mode: 'any' }, platform: 'telegram' },
    { flowId: 'flow-3', nodeType: 'message_received', config: {}, platform: 'telegram' },
    { flowId: 'flow-4', nodeType: 'user_joins', config: {}, platform: 'telegram' },
    { flowId: 'flow-5', nodeType: 'command_received', config: { command: '/help' }, platform: 'telegram' },
    { flowId: 'flow-6', nodeType: 'discord_message_received', config: {}, platform: 'discord' },
  ]

  it('matches command_received trigger', () => {
    const matches = matchTriggers(registry, 'command_received', { command: '/start', text: '/start' })
    expect(matches).toHaveLength(1)
    expect(matches[0]!.flowId).toBe('flow-1')
  })

  it('matches keyword_match on message_received event', () => {
    const matches = matchTriggers(registry, 'message_received', { text: 'I need help please' })
    const flowIds = matches.map(m => m.flowId)
    expect(flowIds).toContain('flow-2') // keyword match
    expect(flowIds).toContain('flow-3') // catch-all
  })

  it('matches user_joins trigger', () => {
    const matches = matchTriggers(registry, 'user_joins', {})
    expect(matches).toHaveLength(1)
    expect(matches[0]!.flowId).toBe('flow-4')
  })

  it('returns empty for unmatched event type', () => {
    const matches = matchTriggers(registry, 'poll_answer', {})
    expect(matches).toEqual([])
  })

  it('ignores discord triggers for telegram events', () => {
    const matches = matchTriggers(registry, 'message_received', { text: 'hello' })
    const flowIds = matches.map(m => m.flowId)
    expect(flowIds).not.toContain('flow-6')
  })

  it('does not match command with wrong name', () => {
    const matches = matchTriggers(registry, 'command_received', { command: '/settings', text: '/settings' })
    expect(matches).toHaveLength(0)
  })
})
