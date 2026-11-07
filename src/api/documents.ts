import { apiClient } from './client'
import { unwrap } from './http'
import type { components } from './schema'

export type DocType = NonNullable<components['schemas']['DocumentResponse']['docType']>
/** Types an admin may upload. PAYOUT_PROOF belongs to a member; the rest are company documents. */
export type AdminDocType = Extract<DocType, 'PAYOUT_PROOF' | 'PNL_EVIDENCE' | 'PAYMENT_QR'>

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const UPLOAD_MIME = {
  image: ['image/jpeg', 'image/png'],
  any: ['image/jpeg', 'image/png', 'application/pdf'],
} as const

/** POST /admin/documents. `ownerUserId` is required for member documents and must be omitted otherwise. */
export function uploadAdminDocument(file: File, docType: AdminDocType, ownerUserId?: string) {
  return unwrap(
    apiClient.POST('/api/v1/admin/documents', {
      params: { query: { docType, ownerUserId } },
      body: { file: '' },
      bodySerializer: () => {
        const fd = new FormData()
        fd.append('file', file)
        return fd
      },
    }),
  )
}
