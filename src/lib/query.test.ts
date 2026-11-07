import { describe, expect, it } from 'vitest'
import { pagedQueryOptions } from './query'

describe('pagedQueryOptions', () => {
  const prev = { items: [1, 2] }

  it('keeps previous rows while paging within the same filters', () => {
    const opts = pagedQueryOptions({ status: 'ACTIVE' })
    expect(opts.placeholderData(prev, { meta: pagedQueryOptions({ status: 'ACTIVE' }).meta })).toBe(prev)
  })

  it('drops previous rows when the filters change (tab switch → loading skeleton)', () => {
    const opts = pagedQueryOptions({ status: 'PENDING_VERIFICATION' })
    expect(opts.placeholderData(prev, { meta: pagedQueryOptions({ status: 'ACTIVE' }).meta })).toBeUndefined()
    expect(opts.placeholderData(prev, undefined)).toBeUndefined()
  })
})
