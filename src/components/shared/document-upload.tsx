import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FileCheck2, Loader2, Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MAX_UPLOAD_BYTES, UPLOAD_MIME, uploadAdminDocument, type AdminDocType } from '@/api/documents'
import { errorMessage } from '@/api/http'
import { cn } from '@/lib/utils'

/**
 * Uploads a file as soon as it is chosen (POST /admin/documents) and reports the
 * document id. `value` is the uploaded id; clearing it only drops the reference.
 */
export function DocumentUpload({
  id,
  docType,
  ownerUserId,
  value,
  onChange,
  imagesOnly = false,
  onBusyChange,
  disabled,
}: {
  id?: string
  docType: AdminDocType
  ownerUserId?: string
  value: string | undefined
  onChange: (documentId: string | undefined) => void
  imagesOnly?: boolean
  onBusyChange?: (busy: boolean) => void
  disabled?: boolean
}) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mimes = imagesOnly ? UPLOAD_MIME.image : UPLOAD_MIME.any
  const kinds = imagesOnly ? 'JPG or PNG' : 'JPG, PNG or PDF'

  function setBusyState(b: boolean) {
    setBusy(b)
    onBusyChange?.(b)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: Object.fromEntries(mimes.map((m) => [m, []])),
    maxFiles: 1,
    maxSize: MAX_UPLOAD_BYTES,
    disabled: disabled || busy,
    onDropRejected: (r) => setError(r[0]?.errors[0]?.code === 'file-too-large' ? 'File is larger than 5 MB.' : `Choose one ${kinds} file.`),
    onDropAccepted: async ([file]) => {
      if (!file) return
      setError(null)
      setBusyState(true)
      try {
        const doc = await uploadAdminDocument(file, docType, ownerUserId)
        setFileName(file.name)
        onChange(doc.id)
      } catch (e) {
        setError(errorMessage(e))
        onChange(undefined)
      } finally {
        setBusyState(false)
      }
    },
  })

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-emerald-50/60 px-3 py-2 text-sm dark:bg-emerald-400/5">
        <FileCheck2 className="size-4 text-emerald-600" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">{fileName ?? 'Uploaded'}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Remove file"
          disabled={disabled}
          onClick={() => {
            setFileName(null)
            onChange(undefined)
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed px-3 py-3 text-sm transition',
          isDragActive ? 'border-brand bg-brand-soft dark:bg-brand/10' : 'border-slate-200 hover:border-brand/40 dark:border-white/10',
          (disabled || busy) && 'cursor-not-allowed opacity-60',
        )}
      >
        <input {...getInputProps({ id })} />
        {busy ? <Loader2 className="size-4 animate-spin text-brand" aria-hidden /> : <Paperclip className="size-4 text-brand" aria-hidden />}
        <span>{busy ? 'Uploading…' : `Drop or choose a file · ${kinds}, max 5 MB`}</span>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
