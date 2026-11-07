import { lazy, Suspense, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import { Download, FileText, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiClient } from '@/api/client'
import { unwrapBlob } from '@/api/http'
import { useObjectUrl } from '@/hooks/use-object-url'
import { ErrorState } from './layout'

const PdfView = lazy(() => import('./pdf-view'))

export function DocumentViewer({
  documentId,
  title = 'Document',
}: {
  documentId: string | null | undefined
  title?: string
}) {
  const doc = useObjectUrl(documentId ?? null, () =>
    unwrapBlob(
      apiClient.GET('/api/v1/admin/documents/{id}/content', {
        params: { path: { id: documentId ?? '' } },
        parseAs: 'blob',
      }),
    ),
  )
  const [zoomOpen, setZoomOpen] = useState(false)

  if (!documentId) return <p className="text-muted-foreground text-sm">No document uploaded.</p>
  if (doc.error) return <ErrorState error={doc.error} onRetry={doc.retry} />
  const url = doc.url
  if (!url) return <Skeleton className="h-80 w-full rounded-2xl" aria-label={`Loading ${title}`} />

  const isPdf = doc.type.includes('pdf')
  const isImage = doc.type.startsWith('image/')
  // Original upload name from the server; the label is only a fallback.
  const downloadName = doc.filename ?? title

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
          {doc.filename ? (
            <>
              <FileText className="size-4 shrink-0" aria-hidden />
              <span className="truncate font-medium" title={doc.filename}>
                {doc.filename}
              </span>
            </>
          ) : null}
        </p>
        <div className="flex shrink-0 gap-2">
          {isImage ? (
            <Button variant="outline" size="sm" onClick={() => setZoomOpen(true)}>
              <ZoomIn className="size-4" /> Zoom
            </Button>
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <a href={url} download={downloadName} aria-label={`Download ${downloadName}`}>
              <Download className="size-4" /> Download
            </a>
          </Button>
        </div>
      </div>
      <div className="bg-muted/40 flex justify-center overflow-hidden rounded-2xl border p-3">
        {isImage ? (
          <button type="button" onClick={() => setZoomOpen(true)} aria-label={`Zoom ${title}`}>
            <img src={url} alt={title} className="max-h-[480px] rounded-xl object-contain" />
          </button>
        ) : isPdf ? (
          <Suspense fallback={<Skeleton className="h-[480px] w-[360px] rounded-2xl" />}>
            <PdfView url={url} />
          </Suspense>
        ) : (
          <p className="text-muted-foreground p-8 text-sm">Preview not available. Use Download.</p>
        )}
      </div>
      {isImage ? (
        <Lightbox
          open={zoomOpen}
          close={() => setZoomOpen(false)}
          slides={[{ src: url, alt: title }]}
          plugins={[Zoom]}
          carousel={{ finite: true }}
          render={{ buttonPrev: () => null, buttonNext: () => null }}
        />
      ) : null}
    </div>
  )
}
