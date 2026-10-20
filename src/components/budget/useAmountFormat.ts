import { useShowsShares } from '@/data/queries'
import { formatShare } from '@/domain/guestFigures'
import { formatCad } from '@/domain/money'

const formatAmount = (cents: number) => formatCad(cents)

/**
 * How to show a budget figure to this viewer: dollars, or (for guests of a wedding in
 * percentage mode) a share of the wedding's total budget, e.g. "12.5%".
 */
export function useAmountFormat() {
  const shares = useShowsShares()
  return { shares, format: shares ? formatShare : formatAmount }
}
