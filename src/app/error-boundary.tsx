import type { ReactNode } from 'react'
import { ErrorBoundary as REB, type FallbackProps } from 'react-error-boundary'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

function Fallback({ resetErrorBoundary }: FallbackProps) {
  // Deliberately no error details on screen (may contain PII).
  return (
    <div role="alert" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <p className="text-lg font-extrabold">Something went wrong on this page</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Try again. If it keeps happening, reload the console.
      </p>
      <div className="flex gap-2">
        <Button onClick={resetErrorBoundary}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  )
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <REB FallbackComponent={Fallback}>{children}</REB>
}
