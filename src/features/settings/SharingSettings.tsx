import { CircleCheck, CircleX, Copy, LoaderCircle, RefreshCw } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { shareLink, weddingPaths } from '@/app/paths'
import { useWeddingRoute } from '@/app/WeddingContext'
import { useAccess } from '@/auth/AccessContext'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { FormField } from '@/components/forms/FormField'
import { SegmentedControl } from '@/components/forms/SegmentedControl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WeddingData } from '@/data/queries'
import { RepositoryError } from '@/data/repository'
import { SLUG_MAX, slugError } from '@/domain/slug'
import type { GuestAmounts, WeddingVisibility } from '@/domain/types'
import { copyText } from '@/lib/download'
import { errorMessage } from '@/lib/errors'

import {
  useChangeSlug,
  useResetShareKey,
  useShareKey,
  useSlugAvailability,
  useUpdateSharing,
} from './mutations'

const VISIBILITY = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
] as const

const GUEST_AMOUNTS = [
  { value: 'amounts', label: 'Amounts' },
  { value: 'percentages', label: 'Percentages' },
] as const

/** The host shown before a wedding's address, e.g. `www.mywedonomics.com/w/`. */
const addressPrefix = () => `${window.location.host}/w/`

/** Who can view the wedding, what guests see, and the link to share. */
export function SharingSettings({ data }: { data: WeddingData }) {
  const { wedding } = data.snapshot
  const { slug } = useWeddingRoute()
  const update = useUpdateSharing()
  const shareKey = useShareKey(wedding.id)
  const reset = useResetShareKey(wedding.id)
  const [confirmReset, setConfirmReset] = useState(false)
  const isPrivate = wedding.visibility === 'private'
  const link = isPrivate
    ? shareKey.data && shareLink(window.location.origin, slug, shareKey.data)
    : shareLink(window.location.origin, slug, null)

  function save(patch: { visibility?: WeddingVisibility; guestAmounts?: GuestAmounts }) {
    update.mutate(
      { id: wedding.id, patch },
      { onError: (error) => toast.error(errorMessage(error)) },
    )
  }

  async function copy() {
    if (!link) return
    if (await copyText(link)) toast.success('Link copied')
    else toast.error('Couldn’t copy. Select the link and copy it instead.')
  }

  function confirmResetLink() {
    setConfirmReset(false)
    reset.mutate(undefined, {
      onSuccess: () => toast.success('New link ready. Old links no longer work.'),
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  return (
    <div className="flex flex-col divide-y">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Who can view</p>
          <p className="text-sm text-muted-foreground">
            {isPrivate
              ? 'Only people with your share link. It’s never listed in search.'
              : 'Anyone, and it’s listed in Wedonomics search.'}
          </p>
        </div>
        <SegmentedControl
          label="Who can view"
          options={VISIBILITY}
          value={wedding.visibility}
          onChange={(visibility) => visibility !== wedding.visibility && save({ visibility })}
          className="w-48"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Guests see</p>
          <p className="text-sm text-muted-foreground">
            {wedding.guestAmounts === 'amounts'
              ? 'Dollar amounts, like you do.'
              : 'Each budget as a percentage of the total; payments show only date and status.'}
          </p>
        </div>
        <SegmentedControl
          label="Guests see"
          options={GUEST_AMOUNTS}
          value={wedding.guestAmounts}
          onChange={(guestAmounts) =>
            guestAmounts !== wedding.guestAmounts && save({ guestAmounts })
          }
          className="w-56"
        />
      </div>

      <div className="flex flex-col gap-3 p-5">
        <FormField
          label="Share link"
          hint={
            isPrivate
              ? 'Anyone with this link can view the wedding. Reset it to stop old links working.'
              : 'If you make the wedding Private, this link stops working; share the new one.'
          }
        >
          <Input
            readOnly
            value={link ?? (shareKey.isError ? 'Couldn’t load the link.' : 'Loading…')}
            onFocus={(e) => e.currentTarget.select()}
          />
        </FormField>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" disabled={!link} onClick={() => void copy()}>
            <Copy data-icon="inline-start" />
            Copy link
          </Button>
          {isPrivate && (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              disabled={reset.isPending || !shareKey.data}
              onClick={() => setConfirmReset(true)}
            >
              {reset.isPending ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Reset link
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset the share link?"
        description="Everyone you’ve shared the current link with loses access. You’ll get a new link to share again."
        confirmLabel="Reset link"
        destructive
        onConfirm={confirmResetLink}
      />
    </div>
  )
}

/** The readable part of the wedding's address (`/w/{slug}`). */
export function WebAddressForm({ data }: { data: WeddingData }) {
  const { wedding } = data.snapshot
  const { slug: current } = useWeddingRoute()
  const { plannerSlugChanged } = useAccess()
  const navigate = useNavigate()
  const change = useChangeSlug(wedding.id)
  const [slug, setSlug] = useState(current)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState<string | null>(null)
  const availability = useSlugAvailability(slug, current)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = slug.trim().toLowerCase()
    const problem = slugError(next)
    setSlug(next)
    setError(problem ?? undefined)
    if (!problem && next !== current) setPending(next)
  }

  function confirm() {
    const next = pending
    setPending(null)
    if (!next) return
    change.mutate(next, {
      onSuccess: () => {
        // Before navigating, so planner controls are already on when the new address opens.
        plannerSlugChanged(next)
        void navigate(weddingPaths(next).settings, { replace: true, viewTransition: true })
        toast.success('Web address changed')
      },
      onError: (failure) => {
        if (failure instanceof RepositoryError && failure.reason === 'conflict') {
          setError('That address is taken. Try another.')
        } else if (failure instanceof RepositoryError && failure.reason === 'invalid') {
          setError(failure.message)
        } else {
          toast.error(errorMessage(failure))
        }
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-5">
      <FormField label="Web address" error={error} hint={`${addressPrefix()}${slug || '…'}`}>
        <Input
          value={slug}
          // Lower-case letters, numbers and hyphens only; spaces become hyphens as you type.
          onChange={(e) => {
            setSlug(e.target.value.toLowerCase().replace(/\s/g, '-'))
            setError(undefined)
          }}
          maxLength={SLUG_MAX}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </FormField>
      <p aria-live="polite" className="-mt-2 min-h-5 text-sm">
        {!error && <AvailabilityStatus availability={availability} />}
      </p>
      <Button
        type="submit"
        variant="outline"
        className="self-start"
        disabled={change.isPending || slug === current || availability === 'taken'}
      >
        {change.isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
        Change address
      </Button>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Change the web address?"
        description={`Links to ${addressPrefix()}${current}, including ones you’ve already shared, will stop working. Share the new link afterwards.`}
        confirmLabel="Change address"
        onConfirm={confirm}
      />
    </form>
  )
}

function AvailabilityStatus({
  availability,
}: {
  availability: ReturnType<typeof useSlugAvailability>
}) {
  switch (availability) {
    case 'checking':
      return (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Checking…
        </span>
      )
    case 'available':
      return (
        <span className="inline-flex items-center gap-1.5 text-success">
          <CircleCheck className="size-4" aria-hidden="true" /> Available
        </span>
      )
    case 'taken':
      return (
        <span className="inline-flex items-center gap-1.5 text-destructive">
          <CircleX className="size-4" aria-hidden="true" /> That address is taken. Try another.
        </span>
      )
    default:
      // idle, or the check failed: saving still tells the planner if it's taken.
      return null
  }
}
