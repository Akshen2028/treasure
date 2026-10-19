import { Sparkles } from 'lucide-react'

import { useAccess } from '@/auth/AccessContext'
import { Button } from '@/components/ui/button'
import { useWeddingData } from '@/data/queries'
import { buildWeddingExport, exportToMarkdown } from '@/domain/export'
import { useMediaUrl } from '@/features/media/useMediaUrl'

import { openAssistant } from './openAssistant'

/**
 * Floating shortcut on every screen: same as "Open in ChatGPT" on the export page, using the
 * Markdown export. Planners only, like the export itself.
 */
export function ChatGptButton() {
  const { isPlanner } = useAccess()
  const { data } = useWeddingData()
  const mediaUrl = useMediaUrl()
  if (!isPlanner) return null

  function open() {
    if (!data) return
    // Built on click (not on every render) and synchronously, so the copy keeps the click.
    const exported = buildWeddingExport(data.snapshot, {
      mediaUrl,
      generatedAt: new Date().toISOString(),
    })
    openAssistant('ChatGPT', exportToMarkdown(exported))
  }

  return (
    <Button
      onClick={open}
      disabled={!data}
      size="icon"
      title="Ask ChatGPT"
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 size-14 rounded-full shadow-lifted"
    >
      <Sparkles className="size-6" aria-hidden="true" />
      <span className="sr-only">Ask ChatGPT (opens a new chat and copies the wedding export)</span>
    </Button>
  )
}
