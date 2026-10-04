import { useStore } from './store';
import {
  buildDashboardData,
  type DashboardData,
  type PendingCounts,
} from './dashboard';
import { useLatestTaxEstimate } from './derived';
import type { TaxEstimateResult } from '../domain/tax';
import { localDateISO } from '../domain/date';

export type { DashboardData, PendingCounts };

const LOADING_TAX: TaxEstimateResult = {
  status: 'review_required',
  reason: 'loading',
  lines: [],
};

export function useDashboardData(): DashboardData {
  const data = useStore();
  const { estimate } = useLatestTaxEstimate(localDateISO());
  return buildDashboardData(data, estimate ?? LOADING_TAX);
}
