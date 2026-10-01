import { useEffect, useState } from 'react';
import { useStore } from './store';
import {
  buildDashboardData,
  getTaxEstimate,
  type DashboardData,
  type PendingCounts,
} from './dashboard';
import type { TaxEstimateResult } from '../domain/tax';

export type { DashboardData, PendingCounts };

const LOADING_TAX: TaxEstimateResult = {
  status: 'review_required',
  reason: 'loading',
  lines: [],
};

export function useDashboardData(): DashboardData {
  const data = useStore();
  const [tax, setTax] = useState<TaxEstimateResult>(LOADING_TAX);

  useEffect(() => {
    let cancelled = false;
    getTaxEstimate(data, new Date().toISOString().slice(0, 10)).then((result) => {
      if (!cancelled) setTax(result);
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  return buildDashboardData(data, tax);
}
