import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { makeJwt, refreshExpiry, TEST_ADMIN } from '@/test/jwt'
import { tokenStore } from './auth/tokenStore'
import { uploadAdminDocument } from './documents'

beforeEach(() => {
  tokenStore.clear()
  tokenStore.setTokens({
    accessToken: makeJwt(30 * 60, 'ADMIN'),
    refreshToken: 'r1',
    expiresAt: refreshExpiry(),
    admin: TEST_ADMIN,
  })
})

describe('uploadAdminDocument', () => {
  it('posts multipart with docType and ownerUserId for member documents', async () => {
    let seen: { docType: string | null; owner: string | null; contentType: string | null } | null =
      null
    server.use(
      // Body isn't read here: jsdom's File + Node's fetch disagree on multipart length when parsed.
      http.post('*/api/v1/admin/documents', ({ request }) => {
        const url = new URL(request.url)
        seen = {
          docType: url.searchParams.get('docType'),
          owner: url.searchParams.get('ownerUserId'),
          contentType: request.headers.get('Content-Type'),
        }
        return HttpResponse.json({
          id: '11111111-1111-4111-8111-111111111111',
          docType: 'PAYOUT_PROOF',
        })
      }),
    )
    const doc = await uploadAdminDocument(
      new File(['x'], 'proof.png', { type: 'image/png' }),
      'PAYOUT_PROOF',
      'u-1',
    )
    expect(doc.id).toBe('11111111-1111-4111-8111-111111111111')
    expect(seen).toMatchObject({ docType: 'PAYOUT_PROOF', owner: 'u-1' })
    expect(seen!.contentType).toMatch(/^multipart\/form-data/)
  })

  it('omits ownerUserId for company documents', async () => {
    let owner: string | null = 'unset'
    server.use(
      http.post('*/api/v1/admin/documents', ({ request }) => {
        owner = new URL(request.url).searchParams.get('ownerUserId')
        return HttpResponse.json({ id: '22222222-2222-4222-8222-222222222222' })
      }),
    )
    await uploadAdminDocument(new File(['x'], 'qr.png', { type: 'image/png' }), 'PAYMENT_QR')
    expect(owner).toBeNull()
  })
})
