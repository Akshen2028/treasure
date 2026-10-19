import { ExternalLink, Share2 } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { canShareFile } from '@/lib/download'

import { ASSISTANTS, openAssistant } from './openAssistant'

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
        {ASSISTANTS.map(({ name }) => (
          <Button key={name} variant="outline" onClick={() => openAssistant(name, text)}>
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
