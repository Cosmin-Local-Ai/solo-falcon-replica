import { useStore } from './store';
import {
  buildDashboardData,
  type DashboardData,
  type PendingCounts,
} from './dashboard';
import { useLatestTaxEstimate } from './derived';
import { localDateISO } from '../domain/date';

export type { DashboardData, PendingCounts };

/**
 * TASK 8: no sentinel. This used to substitute a `review_required` result whose `reason` was the
 * internal token `loading`, which made „nothing has been calculated yet” indistinguishable from „the
 * engine refused and said why” — and printed the word `loading` on the chart note. `null` is passed
 * through, and `DashboardData.estimateState` renders it as the third state it actually is.
 */
export function useDashboardData(): DashboardData {
  const data = useStore();
  const { estimate } = useLatestTaxEstimate(localDateISO());
  return buildDashboardData(data, estimate);
}
