import type { MoneyPrecisionNotice } from '../data/migration';
import { formatBaniLei } from '../domain/money';

/**
 * Phase 10, B-26 — the money-conversion report reaching a screen.
 *
 * `convertMoneyToBani` refuses to decide silently: when a stored value cannot be reproduced exactly as an
 * integer number of bani it records a `MoneyPrecisionNotice` naming the collection, the record id, the
 * field, the value as stored and the value it became. Producing that report was never the hard part —
 * keeping it was. It used to be dropped by `toAppData` and erased by the first write after a load, so
 * acceptance criterion 6 ("a persisted value that cannot be converted must surface, not vanish") was only
 * half-met. This component is the "surface" half.
 *
 * Two rules this file must not break:
 * - **The converted amount is `Bani`, so it goes through `formatBaniLei`.** A raw `67450` on screen is the
 *   exact defect this phase exists to remove.
 * - **The original amount is NOT money in the new unit** — it is a pre-conversion amount in lei, kept
 *   verbatim on purpose so the person can see what changed. It is never passed through a money formatter,
 *   and it is labelled as the stored value so nobody reads it as a rounded one.
 *
 * Wording note: the copy says „la banul cel mai apropiat (0,01 lei)", not „la leul cel mai apropiat". The
 * conversion rounds to 0,01 lei; rounding to a whole leu is CF art. 66 alin. (1) and happens only at the
 * three tax lines, so saying „leu" here would overstate what was done to the user's money by 100×.
 */

const COLLECTION_LABEL: Record<MoneyPrecisionNotice['collection'], string> = {
  revenues: 'venituri',
  expenses: 'cheltuieli',
  declarations: 'declarații',
  profile: 'profil',
  snapshot: 'calcul salvat',
};

/**
 * Romanian agreement. The counts are per kind (adjusted vs carried), so a noun and its verb have to follow
 * the number they belong to — "1 valoare au fost rotunjite" is the kind of slip that makes a tax notice read
 * like machine output, and it is easy to introduce when a count is interpolated.
 */
function noun(n: number): string {
  return n === 1 ? 'valoare' : 'valori';
}

function headline(n: number): string {
  return n === 1 ? 'O sumă nu a putut fi reprodusă exact.' : `${n} sume nu au putut fi reproduse exact.`;
}

function adjustedSentence(n: number): string {
  return n === 1
    ? `${n} ${noun(n)} a fost rotunjită la banul cel mai apropiat (0,01 lei), jumătate în jos — aceeași direcție pe care o folosește art. 66 alin. (1).`
    : `${n} ${noun(n)} au fost rotunjite la banul cel mai apropiat (0,01 lei), jumătate în jos — aceeași direcție pe care o folosește art. 66 alin. (1).`;
}

function carriedSentence(n: number): string {
  return n === 1
    ? `${n} ${noun(n)} nu este un număr valid și a fost păstrată neschimbată, nu înlocuită cu 0.`
    : `${n} ${noun(n)} nu sunt numere valide și au fost păstrate neschimbate, nu înlocuite cu 0.`;
}

/**
 * The stored value, exactly as it was written. Deliberately not `formatBani*`: this is a pre-conversion
 * amount in lei, and showing `674.504` is the point — the reader has to be able to compare it against what
 * the app used instead. It arrives as text for the same reason (see `MoneyPrecisionNotice.original`): a
 * `NaN` cannot survive the JSON round-trip as a number.
 */
function storedLei(original: string): string {
  return original;
}

export function MoneyPrecisionNoticeBanner({ notices }: { notices: MoneyPrecisionNotice[] }) {
  if (notices.length === 0) return null;

  const adjusted = notices.filter((n) => n.converted !== undefined).length;
  const carried = notices.filter((n) => n.converted === undefined).length;

  return (
    <div className="banner banner-warn" role="status">
      <strong>{headline(notices.length)}</strong>{' '}
      {adjusted > 0 && <>{adjustedSentence(adjusted)} </>}
      {carried > 0 && <>{carriedSentence(carried)} </>}
      Nicio sumă nu a fost ștearsă.
      <details className="banner-details">
        <summary>Ce sume anume</summary>
        <ul>
          {notices.map((n, i) => (
            <li key={`${n.collection}:${n.id}:${n.field}:${i}`}>
              {COLLECTION_LABEL[n.collection]} · {n.id} · {n.field}: {storedLei(n.original)} lei (așa cum a
              fost salvat) →{' '}
              {n.converted === undefined ? 'păstrată neschimbată' : formatBaniLei(n.converted)}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
