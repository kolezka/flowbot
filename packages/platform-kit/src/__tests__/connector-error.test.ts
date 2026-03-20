import { describe, it, expect } from 'vitest'
import { ConnectorError } from '../connector-error.js'

describe('ConnectorError', () => {
  it('creates error with message and code', () => {
    const err = new ConnectorError('something failed', 'ACTION_FAILED')
    expect(err.message).toBe('something failed')
    expect(err.code).toBe('ACTION_FAILED')
    expect(err.name).toBe('ConnectorError')
    expect(err.original).toBeUndefined()
  })

  it('wraps original error with cause chain', () => {
    const cause = new Error('root cause')
    const err = new ConnectorError('wrapper', 'TRANSPORT_ERROR', cause)
    expect(err.original).toBe(cause)
    expect(err.stack).toContain('Caused by:')
  })

  it('is instanceof Error', () => {
    const err = new ConnectorError('test', 'TEST')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ConnectorError)
  })
})
