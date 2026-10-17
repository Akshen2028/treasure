import { useEffect } from 'react'

/** Sets the browser tab title, e.g. "Reception · Wedonomics"; "Wedonomics" alone when empty. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Wedonomics` : 'Wedonomics'
    // Reset on leaving, so a page without its own title never keeps the previous page's.
    return () => {
      document.title = 'Wedonomics'
    }
  }, [title])
}
