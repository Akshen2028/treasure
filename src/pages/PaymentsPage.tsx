import { CircleOff, Plus, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { useWeddingPaths } from '@/app/WeddingContext'
import { useAccess } from '@/auth/AccessContext'
import { EmptyState } from '@/components/feedback/EmptyState'
import { WeddingDataBoundary } from '@/components/feedback/WeddingDataBoundary'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { ItemActionsMenu } from '@/components/layout/ItemActionsMenu'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import type { WeddingData } from '@/data/queries'
import { useDeleteWithUndo } from '@/data/softDelete'
import { formatDate } from '@/domain/dates'
import { formatCad } from '@/domain/money'
import type { Payment } from '@/domain/types'
import { ActivityMoney } from '@/features/activities/ActivityMoney'
import { sortPayments } from '@/features/payments/paymentForm'
import { PaymentFormSheet } from '@/features/payments/PaymentFormSheet'

type Params = { eventId: string; categoryId: string; activityId: string }

function PaymentsContent({
  data,
  eventId,
  categoryId,
  activityId,
}: { data: WeddingData } & Params) {
  const paths = useWeddingPaths()
  const { isPlanner } = useAccess()
  // Guests in percentage mode see when each payment was made, not how much.
  const shares = data.showsShares
  const deleteWithUndo = useDeleteWithUndo()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Payment | null>(null)

  const summary = data.budget.activities.get(activityId)
  const activity = data.active.activities.find(
    (a) => a.id === activityId && a.eventCategoryId === categoryId,
  )
  const activityUrl = paths.activity(eventId, categoryId, activityId)

  if (!summary || !activity) {
    return (
      <>
        <DetailHeader backTo={activityUrl} backLabel="Activity" />
        <PageContainer>
          <EmptyState
            icon={CircleOff}
            title="Activity not available"
            description="It may have been deleted, or the link is incorrect."
            action={
              <Button asChild variant="outline">
                <Link viewTransition to={paths.home}>
                  Back to dashboard
                </Link>
              </Button>
            }
            className="my-8"
          />
        </PageContainer>
      </>
    )
  }

  const payments = sortPayments(data.active.payments.filter((p) => p.activityId === activity.id))
  const formProps = {
    weddingId: data.snapshot.wedding.id,
    activityId: activity.id,
    activityName: activity.name,
    summary,
  }

  return (
    <>
      <DetailHeader backTo={activityUrl} backLabel={activity.name} title="Payments" />
      <PageContainer>
        <section className="pt-8">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">{activity.name}</p>
          <h1 className="mt-1 text-4xl sm:text-5xl">Payments</h1>
        </section>

        <section
          aria-label="Payment summary"
          className="mt-6 rounded-2xl border bg-card p-5 shadow-soft sm:p-6"
        >
          <ActivityMoney summary={summary} />
        </section>

        <section className="mt-10" aria-labelledby="history-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 id="history-heading" className="text-3xl">
              History
            </h2>
            {isPlanner && payments.length > 0 && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus data-icon="inline-start" />
                Add payment
              </Button>
            )}
          </div>

          {payments.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No payments yet"
              description={
                isPlanner
                  ? 'Record each installment as you pay it: deposits, balances, tips.'
                  : 'No payments have been recorded for this activity.'
              }
              action={
                isPlanner && (
                  <Button onClick={() => setAdding(true)}>
                    <Plus data-icon="inline-start" />
                    Add the first payment
                  </Button>
                )
              }
            />
          ) : (
            <ol className="overflow-hidden rounded-2xl border bg-card shadow-soft">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex min-h-16 items-center gap-3 py-3 pr-1 pl-5 [&+&]:border-t"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-medium tabular-nums">
                      {shares ? 'Paid' : formatCad(payment.amountCents, { cents: 'always' })}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {formatDate(payment.paidOn)}
                      {payment.note && ` · ${payment.note}`}
                    </p>
                  </div>
                  {isPlanner && (
                    <ItemActionsMenu
                      label={`Actions for ${formatCad(payment.amountCents)} payment on ${formatDate(payment.paidOn)}`}
                      editLabel="Edit payment"
                      deleteLabel="Delete payment"
                      onEdit={() => setEditing(payment)}
                      onDelete={() =>
                        deleteWithUndo(
                          { kind: 'payment', id: payment.id },
                          `${formatCad(payment.amountCents)} payment`,
                        )
                      }
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {isPlanner && (
          <>
            <PaymentFormSheet open={adding} onOpenChange={setAdding} {...formProps} />
            <PaymentFormSheet
              open={editing !== null}
              onOpenChange={(open) => !open && setEditing(null)}
              {...formProps}
              payment={editing ?? undefined}
            />
          </>
        )}
      </PageContainer>
    </>
  )
}

export function PaymentsPage() {
  const paths = useWeddingPaths()
  const { eventId = '', categoryId = '', activityId = '' } = useParams()
  return (
    <WeddingDataBoundary
      fallbackHeader={
        <DetailHeader
          backTo={paths.activity(eventId, categoryId, activityId)}
          backLabel="Activity"
        />
      }
    >
      {(data) => (
        <PaymentsContent
          data={data}
          eventId={eventId}
          categoryId={categoryId}
          activityId={activityId}
        />
      )}
    </WeddingDataBoundary>
  )
}
