import { LoaderCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/forms/FormField'
import { ResponsiveSheet } from '@/components/forms/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ActivityLink, Id } from '@/domain/types'
import { errorMessage } from '@/lib/errors'

import { parseLinkForm } from './links'
import { useCreateLink, useUpdateLink } from './mutations'

type LinkFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  weddingId: Id
  activityId: Id
  link?: ActivityLink
}

export function LinkFormSheet({ open, onOpenChange, ...rest }: LinkFormSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={rest.link ? 'Edit link' : 'Add link'}
      description={rest.link ? undefined : 'A vendor website, quote, contract or inspiration.'}
    >
      {open && <LinkForm {...rest} onDone={() => onOpenChange(false)} />}
    </ResponsiveSheet>
  )
}

function LinkForm({
  weddingId,
  activityId,
  link,
  onDone,
}: Omit<LinkFormSheetProps, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const create = useCreateLink()
  const update = useUpdateLink()
  const [url, setUrl] = useState(link?.url ?? '')
  const [label, setLabel] = useState(link?.label ?? '')
  const [errors, setErrors] = useState<{ url?: string; label?: string }>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const pending = create.isPending || update.isPending

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = parseLinkForm(url, label)
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    setServerError(null)
    try {
      if (link) await update.mutateAsync({ id: link.id, patch: parsed.value })
      else await create.mutateAsync({ weddingId, activityId, ...parsed.value })
      toast.success(link ? 'Link updated' : 'Link added')
      onDone()
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <FormField label="Web address" error={errors.url}>
        <Input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setErrors((x) => ({ ...x, url: undefined }))
          }}
          placeholder="example.com/quote"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
        />
      </FormField>
      <FormField
        label="Label"
        optional
        error={errors.label}
        hint="Shown instead of the address, e.g. “Signed contract”."
      >
        <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} />
      </FormField>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
          {link ? 'Save link' : 'Add link'}
        </Button>
      </div>
    </form>
  )
}
