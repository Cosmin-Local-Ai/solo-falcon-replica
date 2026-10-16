import { useEffect, useRef } from 'react';
import { useStore } from '../../data/store';
import { yearAdvanceTarget, type FiscalYearView } from '../../data/dashboard';
import { dashboard as copy } from '../../ui/copy';

/**
 * PG-5 (B-73) — the automatic year advance, moved out of the banner and into the shell.
 *
 * PG-4 mounted the advance on the dashboard, so the year only moved the first time the dashboard was
 * opened in the new year. A person who landed on Revenues on 2 January got last year's register, and
 * „last year” was no longer what the clock said. The trigger now lives where every route starts, and it
 * is the ONLY writer of the automatic advance — two components writing the same year is how a toggle
 * back gets overwritten.
 *
 * What PG-4 established still holds and is not re-implemented here: `yearAdvanceTarget` decides, it
 * compares `profile.updatedAt` in the LOCAL year (a UTC prefix comparison re-advanced over the toggle
 * back and Playwright caught it), and the write re-stamps `updatedAt`, which is what makes a deliberate
 * year choice stick across a reload.
 */
export function FiscalYearAdvance() {
  const { profile, updateProfile } = useStore();
  /** The year this session has already written, so a target that will not clear cannot spin. */
  const written = useRef<number | null>(null);
  const target = yearAdvanceTarget(profile);

  useEffect(() => {
    if (target === null || written.current === target) return;
    written.current = target;
    updateProfile({ fiscalYear: target });
    // `updateProfile` is recreated with the store value on every write; `target` is the guard, because
    // it goes null as soon as the write lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return null;
}

/**
 * PG-4 (D-YEAR-1) — the fiscal-year lifecycle, on the face of the dashboard.
 *
 * Three things happen here and nothing else:
 *
 * 1. **The automatic advance — reported here, written by `FiscalYearAdvance` in the shell.** On 1
 *    January the clock names a new fiscal year and the stored profile still names the old one.
 *    `data/dashboard.ts yearAdvanceTarget` decides whether the year moves. B-73 moved the write out of
 *    this component because a trigger mounted on one page only fires on that page; the banner now only
 *    says that the year moved while it was open.
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
  /**
   * The year this banner was first shown. When the year it is shown moves to the year the clock is in,
   * the advance happened while the dashboard was open and that is worth one sentence. A deliberate
   * toggle back moves to a year the clock is NOT in, so it never reads as an automatic advance.
   */
  const mountedYear = useRef(year.year);
  const advancedTo =
    year.year !== mountedYear.current && year.year === year.currentYear ? year.year : null;

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
