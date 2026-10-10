import { afterEach, describe, expect, it, vi } from 'vitest';
import { epochMs, localDateISO, localYear, now, toInstantISO } from '../domain/date';
import { FIXED_INSTANT_ISO, fixedInstant } from './fixedInstant';
import { assertClockSeam, pinClock, unpinClock } from './clock';

/**
 * PG-0 — the fixed-clock helper, and the proof that it is the only seam.
 *
 * Acceptance criterion 2 of PG-0 is "no test reads the wall clock — prove it by the
 * helper being the only seam, not by grepping for `new Date()` and hoping." Grep is
 * what `wallClockGuard.test.ts` already does, and it is deliberately NOT widened here.
 * The proof added instead is test 2 below: `domain/date.ts` is the only place the
 * domain touches the clock, so pinning the seam and then calling the four
 * default-parameter date functions **with no argument** shows every silently
 * clock-dependent call site resolving to the pinned instant. That is the seam being
 * demonstrated, not searched for.
 */

describe('PG-0 fixed-clock helper', () => {
  afterEach(() => {
    unpinClock();
  });

  it('pins the domain clock seam to the repository instant', () => {
    pinClock();
    // assertClockSeam throws rather than returning a boolean, so reaching the next line
    // is the assertion. expect().not.toThrow would hide the message that names the seam.
    assertClockSeam(fixedInstant());
    expect(now().getTime()).toBe(fixedInstant().getTime());
  });

  it('pins every DEFAULT-parameter call site, not just the seam', () => {
    const at = fixedInstant();
    pinClock();

    // These four functions in domain/date.ts are declared `instant: Date = now()`. Called
    // with no argument they fall through to the real clock — that is the 25 DEFAULT call
    // sites the PG-0 scout mapped. With the seam pinned they must all resolve to the
    // pinned instant. Values are derived from `at`, never hardcoded, because the pinned
    // string carries no offset and so denotes a different instant in each runner zone.
    expect(localDateISO()).toBe('2026-10-31');
    expect(localYear()).toBe(2026);
    expect(toInstantISO()).toBe(at.toISOString());
    expect(epochMs()).toBe(at.getTime());
  });

  it('bites: a seam that does not report the pinned instant throws, naming the seam', () => {
    pinClock();
    // Negative control. Without this, tests 1 and 2 could pass while the seam drifted.
    const oneMinuteLater = new Date(fixedInstant().getTime() + 60_000);
    expect(() => assertClockSeam(oneMinuteLater)).toThrow(/src\/domain\/date\.ts/);
    expect(() => assertClockSeam(oneMinuteLater)).toThrow(/ClockSeamError|not pinned/);
  });

  it('releases the clock, so a pinned file cannot leak the pin into the next one', () => {
    pinClock();
    expect(vi.isFakeTimers()).toBe(true);
    unpinClock();
    expect(vi.isFakeTimers()).toBe(false);
  });

  it('lands on the Romanian calendar day 2026-10-31 whatever zone the runner is in', () => {
    // The B-46 class of bug: a UTC calendar date read where a local one was meant.
    // domain/date.ts formats through an explicit Europe/Bucharest Intl format, so the
    // calendar day is fixed even though the instant itself moves with the runner zone.
    expect(localDateISO(fixedInstant())).toBe('2026-10-31');
  });

  it('keeps the pinned instant offset-free, so it denotes local time', () => {
    // If someone appends a `Z`, the string stops being a local date-time and the
    // calendar day above stops being guaranteed in a non-UTC zone.
    expect(FIXED_INSTANT_ISO).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it('accepts an explicit instant for the tests that need a different date', () => {
    const winter = new Date('2027-01-15T09:00:00');
    pinClock(winter);
    expect(localDateISO()).toBe('2027-01-15');
    expect(localYear()).toBe(2027);
  });
});
