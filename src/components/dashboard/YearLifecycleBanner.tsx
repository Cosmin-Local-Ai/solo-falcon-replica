import { useEffect, useState } from 'react';
import { useStore } from '../../data/store';
import type { FiscalYearView } from '../../data/dashboard';
import { dashboard as copy } from '../../ui/copy';

/**
 * PG-4 (D-YEAR-1) — the fiscal-year lifecycle, on the face of the dashboard.
 *
 * Three things happen here and nothing else:
 *
 * 1. **The automatic advance.** On 1 January the clock names a new fiscal year and the stored profile
 *    still names the old one. `data/dashboard.ts yearAdvanceTarget` decides whether the year moves;
 *    this component is where that decision is written back through `updateProfile`. It fires once:
 *    the write re-stamps `profile.updatedAt`, which is what tells the next load that the year on the
 *    record is a choice, not a stale value.
 *
 * 2. **The missing rule package.** A year the build has no rules for gets a sentence, not a number.
 *    This is the failure mode the whole phase exists to prevent: on 1 Jan 2027 the app has no 2027
 *    release, and the honest answer is „Regulile pentru 2027 nu sunt încărcate" — never a zero, never
 *    last year's figure presented as this year's. The engine already refuses
 *    (`domain/tax.ts` returns `review_required` when no release is in force); the banner is what makes
 *    that refusal legible instead of an em dash.
 *
 * 3. **The toggle back.** D-YEAR-1 asks for a way back to a previous year. It writes the year through
 *    the same store path the Settings form uses, so there is one fiscal-year model, not a view-local
 *    override that the estimate would quietly ignore.
 *
 * The component computes no fiscal facts. `year` arrives from `buildDashboardData`, which is the only
 * place the clock is read for this question.
 */
export interface YearLifecycleBannerProps {
  year: FiscalYearView;
}

export function YearLifecycleBanner({ year }: YearLifecycleBannerProps) {
  const { updateProfile } = useStore();
  /** The year this session advanced to, so the banner can say so after the write lands. */
  const [advancedTo, setAdvancedTo] = useState<number | null>(null);

  useEffect(() => {
    if (year.advanceTo === null) return;
    setAdvancedTo(year.advanceTo);
    updateProfile({ fiscalYear: year.advanceTo });
    // `updateProfile` is recreated with the store value on every write; the guard is `year.advanceTo`,
    // which is null again as soon as the write lands. Adding the callback to the deps would re-run the
    // effect on every store change for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year.advanceTo]);

  const rulesMissing = !year.rulesAvailable;
  if (!rulesMissing && !year.closed && advancedTo === null) return null;

  const previousYear = year.year - 1;

  return (
    <div
      className={`banner ${rulesMissing ? 'banner-warn' : ''}`}
      role="status"
      data-year-state={rulesMissing ? 'rules-missing' : year.closed ? 'closed' : 'advanced'}
      data-year={year.year}
    >
      {advancedTo !== null && advancedTo === year.year ? (
        <p className="banner-line">{copy.year.advanced(year.year)}</p>
      ) : null}
      {rulesMissing ? (
        <>
          <strong>{copy.year.rulesMissing(year.year)}</strong>
          <p className="banner-details-paragraph">{copy.year.rulesMissingBody}</p>
          <button className="btn btn-sm" type="button" onClick={() => updateProfile({ fiscalYear: previousYear })}>
            {copy.year.switchTo(previousYear)}
          </button>
        </>
      ) : year.closed ? (
        <>
          <strong>{copy.year.closedArchive(year.year)}</strong>
          {year.currentYear > year.year ? (
            <button className="btn btn-sm" type="button" onClick={() => updateProfile({ fiscalYear: year.currentYear })}>
              {copy.year.switchTo(year.currentYear)}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
