import {
  ChevronRight,
  Eye,
  FileDown,
  KeyRound,
  Lock,
  LogOut,
  type LucideIcon,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { paths } from '@/app/paths'
import { useAccess } from '@/auth/AccessContext'
import { PlannerLoginDialog } from '@/components/auth/PlannerLoginDialog'
import { WeddingDataBoundary } from '@/components/feedback/WeddingDataBoundary'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
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
}: {
  to: string
  icon: LucideIcon
  label: string
  hint: string
}) {
  return (
    <Link
      viewTransition
      to={to}
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

  async function run(kind: 'lock' | 'everywhere') {
    setBusy(kind)
    await (kind === 'lock' ? lock() : signOutEverywhere())
    setBusy(null)
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
              Enter planner password
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
                    <BudgetModeSetting data={data} />
                  </div>
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
      </PageContainer>
    </>
  )
}
