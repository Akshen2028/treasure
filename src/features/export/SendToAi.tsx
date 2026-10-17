import { ExternalLink, Share2 } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { canShareFile, copyTextNow } from '@/lib/download'

/**
 * Short opener sent in the link. It holds none of the wedding data (that would end up in
 * browser history and server logs, and long links get rejected), and it reads correctly
 * whether the assistant sends it straight away or only pre-fills the message box.
 */
export const STARTER_PROMPT =
  'I’m about to paste my wedding budget, exported from my planning app (all amounts are in ' +
  'Canadian dollars). Once it’s pasted, please summarise where things stand, flag anything ' +
  'over budget or overpaid, and list the payments still to make.'

const ASSISTANTS = [
  { name: 'ChatGPT', url: (q: string) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { name: 'Claude', url: (q: string) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
] as const

type SendToAiProps = {
  text: string
  fileName: string
  mimeType: string
  title: string
}

/** One tap to an AI chat: copy the export, open a new chat with an opener; or share the file. */
export function SendToAi({ text, fileName, mimeType, title }: SendToAiProps) {
  const file = useMemo(
    () => new File([text], fileName, { type: mimeType }),
    [text, fileName, mimeType],
  )
  const shareable = useMemo(() => canShareFile(file), [file])

  function open(name: string, url: string) {
    // Copy first, while this page still has focus; then open the chat in a new tab.
    const copied = copyTextNow(text)
    window.open(url, '_blank', 'noopener,noreferrer')
    if (copied) {
      toast.success(`Export copied. In ${name}, paste it into the message box and send.`, {
        duration: 8000,
      })
    } else {
      toast.error('Couldn’t copy automatically. Use Download, then attach the file in the chat.')
    }
  }

  async function share() {
    try {
      await navigator.share({ files: [file], title })
    } catch (error) {
      // Closing the share sheet isn't an error worth reporting.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        toast.error('Couldn’t share the file. Try Download instead.')
      }
    }
  }

  return (
    <section
      aria-labelledby="send-heading"
      className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-soft"
    >
      <div>
        <h2 id="send-heading" className="text-2xl">
          Send to an AI
        </h2>
        <p className="text-sm text-muted-foreground">
          Opens a new chat and copies the export. Paste it in (⌘V, or long-press → Paste) and send.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {ASSISTANTS.map(({ name, url }) => (
          <Button key={name} variant="outline" onClick={() => open(name, url(STARTER_PROMPT))}>
            <ExternalLink data-icon="inline-start" />
            Open in {name}
          </Button>
        ))}
      </div>
      {shareable && (
        <Button variant="secondary" onClick={() => void share()}>
          <Share2 data-icon="inline-start" />
          Share file to an app…
        </Button>
      )}
    </section>
  )
}
