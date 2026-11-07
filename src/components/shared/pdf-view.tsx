import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

/** Loaded lazily so react-pdf/pdf.js only ship to pages that show PDFs. */
export default function PdfView({ url }: { url: string }) {
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  return (
    <div className="flex flex-col items-center gap-3">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setPages(numPages)}
        loading={<Skeleton className="h-[480px] w-[360px] rounded-2xl" />}
        error={<p className="text-sm text-destructive">Couldn't render this PDF.</p>}
      >
        <Page pageNumber={page} width={520} renderTextLayer={false} renderAnnotationLayer={false} />
      </Document>
      {pages > 1 ? (
        <div className="flex items-center gap-2 text-sm">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="tabular-nums">
            Page {page} of {pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
