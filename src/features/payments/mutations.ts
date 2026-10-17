import { useSnapshotMutation } from '@/data/queries'
import type { NewPayment, PaymentPatch } from '@/data/repository'
import type { Id } from '@/domain/types'

/** Money changes wait for the server before showing, so totals are never optimistic. */
export function useCreatePayment() {
  return useSnapshotMutation({
    mutationFn: (repository, input: NewPayment) => repository.createPayment(input),
    reconcile: (snapshot, payment) => ({ ...snapshot, payments: [...snapshot.payments, payment] }),
  })
}

export function useUpdatePayment() {
  return useSnapshotMutation({
    mutationFn: (repository, { id, patch }: { id: Id; patch: PaymentPatch }) =>
      repository.updatePayment(id, patch),
    reconcile: (snapshot, payment) => ({
      ...snapshot,
      payments: snapshot.payments.map((p) => (p.id === payment.id ? payment : p)),
    }),
  })
}
