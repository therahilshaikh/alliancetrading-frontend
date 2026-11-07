import { describe, expect, it } from 'vitest'
import { MULTI_INVESTMENT_ENABLED, PARTIAL_PRINCIPAL_WITHDRAWAL_ENABLED } from './flags'

describe('feature flags', () => {
  it('are booleans, defaulting to false when env is unset', () => {
    expect(typeof MULTI_INVESTMENT_ENABLED).toBe('boolean')
    expect(typeof PARTIAL_PRINCIPAL_WITHDRAWAL_ENABLED).toBe('boolean')
  })
})
