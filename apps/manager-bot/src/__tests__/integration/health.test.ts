import { describe, expect, it } from 'vitest'

describe('health check', () => {
  it('should verify the integration test harness is working', () => {
    expect(true).toBe(true)
  })

  it('should have INTEGRATION_TESTS_ENABLED set', () => {
    expect(process.env.INTEGRATION_TESTS_ENABLED).toBeTruthy()
  })
})
