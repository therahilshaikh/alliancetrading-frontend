import { useEffect, useRef, useState } from 'react'

export interface ObjectUrlState {
  /** Object URL of the loaded blob; revoked when the key changes or on unmount. */
  url: string | null
  /** MIME type of the loaded blob. */
  type: string
  /** Server-provided filename (Content-Disposition), when the blob is a File. */
  filename: string | undefined
  error: unknown
  retry: () => void
}

/**
 * Load an authenticated file (the browser can't send our bearer token on an
 * <img src>) and expose it as an object URL. `key` identifies the file; when it
 * changes the previous URL is revoked and the new one loads. Pass a null key
 * to load nothing.
 */
export function useObjectUrl(key: string | null, load: () => Promise<Blob>): ObjectUrlState {
  const [attempt, setAttempt] = useState(0)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })
  const requestKey = key ? `${key}:${attempt}` : null
  // State is tagged with the request key, so switching files shows the
  // loading state without resetting state inside the effect.
  const [state, setState] = useState<{
    key: string
    url?: string
    type?: string
    filename?: string
    error?: unknown
  } | null>(null)

  useEffect(() => {
    if (!requestKey) return
    let url: string | null = null
    let cancelled = false
    loadRef
      .current()
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setState({
          key: requestKey,
          url,
          type: blob.type,
          filename: blob instanceof File ? blob.name : undefined,
        })
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({ key: requestKey, error: error ?? new Error('Failed to load file') })
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [requestKey])

  const current = state?.key === requestKey ? state : null
  return {
    url: current?.url ?? null,
    type: current?.type ?? '',
    filename: current?.filename,
    error: current?.error ?? null,
    retry: () => setAttempt((a) => a + 1),
  }
}
