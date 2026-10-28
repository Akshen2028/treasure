import {
  ChevronRight,
  Eye,
  FileDown,
  FileText,
  KeyRound,
  Lock,
  LogOut,
  type LucideIcon,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { paths as appPaths } from '@/app/paths'
import { useWeddingPaths } from '@/app/WeddingContext'
import { useAccess } from '@/auth/AccessContext'
import { PlannerLoginDialog } from '@/components/auth/PlannerLoginDialog'
import { WeddingDataBoundary } from '@/components/feedback/WeddingDataBoundary'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { legalTitles } from '@/features/legal/legal'
import { DeleteAccountCard } from '@/features/settings/DeleteAccount'
import type { LegalPageState } from '@/features/legal/LegalPage'
import { SharingSettings, WebAddressForm } from '@/features/settings/SharingSettings'
import { BudgetModeSetting, WeddingDetailsForm } from '@/features/settings/WeddingSettings'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 px-1 font-sans text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">{children}</div>
    </section>
  )
}

function LinkRow({
  to,
  icon: Icon,
  label,
  hint,
  state,
}: {
  to: string
  icon: LucideIcon
  label: string
  hint: string
  state?: LegalPageState
}) {
  return (
    <Link
      viewTransition
      to={to}
      state={state}
      className="flex min-h-16 items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 [&+&]:border-t"
    >
      <Icon className="size-5 shrink-0 text-gold" aria-hidden="true" />
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

function AccessCard() {
  const { isPlanner, lock, signOutEverywhere } = useAccess()
  const [busy, setBusy] = useState<'lock' | 'everywhere' | null>(null)
  const navigate = useNavigate()

  async function run(kind: 'lock' | 'everywhere') {
    setBusy(kind)
    await (kind === 'lock' ? lock() : signOutEverywhere())
    if (kind === 'lock') {
      setBusy(null)
      return
    }
    // Signed out: back to the welcome screen to find a wedding or sign in again.
    void navigate(appPaths.welcome, { replace: true, viewTransition: true })
    toast.success('Signed out on all devices')
  }

  if (!isPlanner) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-4">
          <Eye className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
          <div>
            <p className="font-medium">Viewing as guest</p>
            <p className="text-sm text-muted-foreground">
              You can see everything but can’t make changes.
            </p>
          </div>
        </div>
        <PlannerLoginDialog
          trigger={
            <Button variant="outline" className="self-start">
              <KeyRound data-icon="inline-start" />
              Sign in
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        <div>
          <p className="font-medium">Signed in as planner</p>
          <p className="text-sm text-muted-foreground">
            You’ll stay signed in on this device until you lock it.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" disabled={busy !== null} onClick={() => void run('lock')}>
          <Lock data-icon="inline-start" />
          {busy === 'lock' ? 'Locking…' : 'Lock this device'}
        </Button>
        <Button
          variant="ghost"
          className="text-muted-foreground"
          disabled={busy !== null}
          onClick={() => void run('everywhere')}
        >
          <LogOut data-icon="inline-start" />
          {busy === 'everywhere' ? 'Signing out…' : 'Sign out on all devices'}
        </Button>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const paths = useWeddingPaths()
  const { isPlanner } = useAccess()
  return (
    <>
      <DetailHeader backTo={paths.home} backLabel="Dashboard" title="Settings" />
      <PageContainer>
        <h1 className="pt-8 text-4xl">Settings</h1>

        <Section title="Planner access">
          <AccessCard />
        </Section>

        {isPlanner && (
          <WeddingDataBoundary>
            {(data) => (
              <>
                <Section title="Wedding">
                  <WeddingDetailsForm data={data} />
                  <div className="border-t">
                    <WebAddressForm data={data} />
                  </div>
                  <div className="border-t">
                    <BudgetModeSetting data={data} />
                  </div>
                </Section>

                <Section title="Sharing">
                  <SharingSettings data={data} />
                </Section>

                <Section title="Planner tools">
                  <LinkRow
                    to={paths.recentlyDeleted}
                    icon={Trash2}
                    label="Recently Deleted"
                    hint="Restore deleted events, categories, activities and more"
                  />
                  <LinkRow
                    to={paths.aiExport}
                    icon={FileDown}
                    label="Export for AI"
                    hint="Download the wedding as JSON or Markdown"
                  />
                </Section>
              </>
            )}
          </WeddingDataBoundary>
        )}

        <Section title="Wedonomics">
          <LinkRow
            to={appPaths.welcome}
            icon={Search}
            label="Find another wedding"
            hint="Search public weddings from the Wedonomics home page"
          />
          <LinkRow
            to={appPaths.terms}
            icon={FileText}
            label={legalTitles.terms}
            state={{ from: paths.settings }}
            hint="The rules for using Wedonomics"
          />
          <LinkRow
            to={appPaths.privacy}
            icon={Scale}
            label={legalTitles.privacy}
            state={{ from: paths.settings }}
            hint="What we store and who can see it"
          />
        </Section>

        {isPlanner && (
          <Section title="Danger zone">
            <DeleteAccountCard />
          </Section>
        )}
      </PageContainer>
    </>
  )
}
