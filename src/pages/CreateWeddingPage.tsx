import { Heart, LoaderCircle, LogOut } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Navigate } from 'react-router'
import { toast } from 'sonner'

import { paths } from '@/app/paths'
import { useAccess } from '@/auth/AccessContext'
import { createWeddingFailureMessage } from '@/auth/weddingCreation'
import { Wordmark } from '@/components/brand/Wordmark'
import { SplashScreen } from '@/components/feedback/SplashScreen'
import { FormField } from '@/components/forms/FormField'
import { ResponsiveSheet } from '@/components/forms/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  type CreateWeddingFormErrors,
  type CreateWeddingFormValues,
  emptyCreateWeddingForm,
  parseCreateWeddingForm,
  previewWeddingPath,
  WEDDING_NAME_MAX,
} from '@/features/onboarding/createWeddingForm'
import { type LegalDocument, legalTitles } from '@/features/legal/legal'
import { PrivacyContent, TermsContent } from '@/features/legal/legalDocuments'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** First run for a signed-in account with no wedding: names, an optional date, and consent. */
export function CreateWeddingPage() {
  const { status, mode, plannerSlug, createWedding, lock } = useAccess()
  const [values, setValues] = useState(emptyCreateWeddingForm)
  const [errors, setErrors] = useState<CreateWeddingFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [legal, setLegal] = useState<LegalDocument | null>(null)
  useDocumentTitle('Create your wedding')

  if (status === 'initializing') return <SplashScreen />
  // Once created (or for anyone else), go on: planners to their wedding, others to the start.
  if (mode === 'planner' && plannerSlug) return <Navigate to={paths.wedding(plannerSlug)} replace />
  if (mode !== 'new-account') return <Navigate to={paths.welcome} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const parsed = parseCreateWeddingForm(values)
    setErrors(parsed.ok ? {} : parsed.errors)
    if (!parsed.ok) return
    setSubmitting(true)
    const result = await createWedding(parsed.value.name, parsed.value.weddingDate)
    setSubmitting(false)
    // On success the mode becomes planner and this page redirects to the new wedding.
    if (result.ok) toast.success('Your wedding is ready.')
    else toast.error(createWeddingFailureMessage(result))
  }

  // Editing a field clears its error, so the address preview comes back while typing.
  function change(field: keyof CreateWeddingFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const preview = previewWeddingPath(values.name)
  const legalLink = (document: LegalDocument) => (
    <button
      type="button"
      className="font-medium text-foreground underline underline-offset-2"
      onClick={() => setLegal(document)}
    >
      {legalTitles[document]}
    </button>
  )

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 pt-safe pb-safe">
      {/* Soft champagne glow behind the content, as on the welcome screen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-20%] mx-auto h-[60vh] max-w-2xl rounded-full bg-champagne/50 blur-3xl"
      />

      <div className="relative flex w-full max-w-sm animate-in flex-col items-center duration-500 fade-in slide-in-from-bottom-2">
        <Wordmark />
        <h1 className="mt-8 text-center font-heading text-3xl font-medium">Create your wedding</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          You can change these later in Settings.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 flex w-full flex-col gap-4">
          <FormField
            label="Wedding name"
            error={errors.name}
            hint={
              preview
                ? `Your address: ${preview} (a number is added if it’s taken)`
                : 'Usually the couple’s names, like “Alex & Sam”.'
            }
          >
            <Input
              value={values.name}
              onChange={(e) => change('name', e.target.value)}
              maxLength={WEDDING_NAME_MAX}
              autoComplete="off"
              placeholder="Alex & Sam"
              disabled={submitting}
            />
          </FormField>
          <FormField label="Wedding date" optional error={errors.weddingDate}>
            <Input
              type="date"
              value={values.weddingDate}
              onChange={(e) => change('weddingDate', e.target.value)}
              disabled={submitting}
            />
          </FormField>

          <p className="text-xs leading-relaxed text-muted-foreground">
            By creating your wedding you agree to the {legalLink('terms')} and{' '}
            {legalLink('privacy')}.
          </p>

          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Heart data-icon="inline-start" />
            )}
            {submitting ? 'Creating…' : 'Create wedding'}
          </Button>
        </form>

        <Button
          variant="ghost"
          className="mt-6 text-muted-foreground"
          onClick={() => void lock()}
          disabled={submitting}
        >
          <LogOut data-icon="inline-start" />
          Sign out
        </Button>
      </div>

      {/* In a sheet, so reading them doesn't lose what was typed. */}
      <ResponsiveSheet
        open={legal !== null}
        onOpenChange={(open) => !open && setLegal(null)}
        title={legal ? legalTitles[legal] : ''}
      >
        <div className="pb-6">{legal === 'terms' ? <TermsContent /> : <PrivacyContent />}</div>
      </ResponsiveSheet>
    </main>
  )
}
