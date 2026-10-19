import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { paths } from '@/app/paths'
import { PlannerOnly } from '@/components/auth/PlannerOnly'
import { WeddingDataBoundary } from '@/components/feedback/WeddingDataBoundary'
import { SegmentedControl } from '@/components/forms/SegmentedControl'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { type WeddingData, weddingKeys } from '@/data/queries'
import { CHAT_SUGGESTIONS } from '@/domain/chat'
import { buildWeddingExport, exportFileName, exportToJson, exportToMarkdown } from '@/domain/export'
import { SendToAi } from '@/features/export/SendToAi'
import { useMediaUrl } from '@/features/media/useMediaUrl'
import { copyText, downloadText } from '@/lib/download'

type Format = 'markdown' | 'json'

const FORMATS = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
] as const

function ExportPanel({ data }: { data: WeddingData }) {
  const mediaUrl = useMediaUrl()
  const [format, setFormat] = useState<Format>('markdown')
  const [copied, setCopied] = useState(false)

  // Stamped once when the page opens; the data itself is refetched on open (see FreshData).
  const [generatedAt] = useState(() => new Date().toISOString())
  const exported = useMemo(
    () => buildWeddingExport(data.snapshot, { mediaUrl, generatedAt }),
    [data.snapshot, mediaUrl, generatedAt],
  )
  const text = useMemo(
    () => (format === 'markdown' ? exportToMarkdown(exported) : exportToJson(exported)),
    [exported, format],
  )
  const fileName = exportFileName(
    exported.wedding.name,
    exported.generatedAt,
    format === 'markdown' ? 'md' : 'json',
  )
  const activities = exported.events.flatMap((e) => e.categories.flatMap((c) => c.activities))
  const counts = [
    [exported.events.length, 'event'],
    [activities.length, 'activity'],
    [activities.reduce((n, a) => n + a.payments.length, 0), 'payment'],
    [activities.reduce((n, a) => n + a.photos.length, 0), 'photo link'],
  ] as const
  const sizeKb = Math.max(1, Math.round(new Blob([text]).size / 1024))

  async function copy() {
    if (await copyText(text)) {
      setCopied(true)
      toast.success('Copied. Paste it into ChatGPT or Claude.')
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error('Couldn’t copy on this device. Use Download instead.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">
        Everything about the wedding (events, categories, activities, notes, budgets, payments,
        dates, locations and links) in one file you can give to an AI assistant. Deleted items are
        left out.
      </p>

      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            label="Export format"
            options={FORMATS}
            value={format}
            onChange={setFormat}
            className="w-56"
          />
          <p className="text-sm text-muted-foreground">
            {format === 'markdown' ? 'Best for pasting into a chat.' : 'Structured data.'}
          </p>
        </div>

        <ul className="flex flex-wrap gap-2 text-sm">
          {counts
            .filter(([n, noun]) => n > 0 || noun === 'event' || noun === 'activity')
            .map(([n, noun]) => (
              <li
                key={noun}
                className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground"
              >
                {n}{' '}
                {noun === 'activity'
                  ? n === 1
                    ? 'activity'
                    : 'activities'
                  : `${noun}${n === 1 ? '' : 's'}`}
              </li>
            ))}
          <li className="rounded-full bg-muted px-3 py-1 text-muted-foreground">{sizeKb} KB</li>
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() =>
              downloadText(
                fileName,
                text,
                format === 'markdown' ? 'text/markdown' : 'application/json',
              )
            }
          >
            <Download data-icon="inline-start" />
            Download {format === 'markdown' ? '.md' : '.json'}
          </Button>
          <Button variant="outline" onClick={() => void copy()}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? 'Copied' : 'Copy to clipboard'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">File name: {fileName}</p>
      </section>

      <SendToAi
        text={text}
        fileName={fileName}
        mimeType={format === 'markdown' ? 'text/markdown' : 'application/json'}
        title={`${exported.wedding.name}: wedding budget`}
      />

      <section aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="mb-2 text-2xl">
          Preview
        </h2>
        {/* A labelled, keyboard-focusable scroll area for the preview. */}
        <section
          // Scrollable regions must be reachable by keyboard (WCAG 2.1.1).
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          aria-label={`${format === 'markdown' ? 'Markdown' : 'JSON'} export preview`}
          className="max-h-96 overflow-auto rounded-2xl border bg-muted/50 p-4"
        >
          <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">{text}</pre>
        </section>
      </section>

      <section aria-labelledby="prompts-heading" className="rounded-2xl border border-dashed p-5">
        <h2 id="prompts-heading" className="mb-2 inline-flex items-center gap-2 text-2xl">
          <Sparkles className="size-5 text-gold" aria-hidden="true" />
          Things to ask
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {CHAT_SUGGESTIONS.map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** Fetches the latest data once on open, so the export reflects the database right now. */
function FreshData({ children }: { children: (data: WeddingData) => React.ReactNode }) {
  const queryClient = useQueryClient()
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: weddingKeys.all })
  }, [queryClient])
  return <WeddingDataBoundary>{children}</WeddingDataBoundary>
}

export function AiExportPage() {
  return (
    <>
      <DetailHeader backTo={paths.settings} backLabel="Settings" title="Export for AI" />
      <PageContainer>
        <h1 className="pt-8 pb-4 text-4xl">Export for AI</h1>
        <PlannerOnly feature="AI Export">
          <FreshData>{(data) => <ExportPanel data={data} />}</FreshData>
        </PlannerOnly>
      </PageContainer>
    </>
  )
}
