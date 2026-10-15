/**
 * B110 — fixture identity hygiene.
 *
 * The demo fixture used to carry three identifiers that belong to, or could belong to, real third
 * parties. In order of how much they matter:
 *
 * 1. **An IBAN built on a real bank's BIC prefix.** `banca: 'BCR'` sat next to
 *    `contBancar: 'RO44 BACX 0000 0000 1234 5678 9000'`. `BACX` is Banca Comercială Română's real BIC
 *    bank code, so the fixture showed a real-format IBAN for a named real bank. It is now
 *    `Banca Carpatică` / `RO44 CARP …` — a coinage, in the same real *format*.
 * 2. **A real retailer's trademark** as a demo supplier (`Carrefour`).
 * 3. **A domain we neither own nor verified** (`popescuconsulting.ro`) in two demo email addresses.
 *
 * The replacement set is invented but relatable — `Dobre Radu`, `Codexa SRL`, `Coșul Zilnic SRL`,
 * `Conectica SRL`, `Papetaria SRL`, `Enache Sorin`, `Barbu Cristina` — because a demo nobody believes
 * teaches nothing. Placeholder-branded names (`Furnizor Exemplu`) were considered and rejected.
 *
 * **The email domains are `.example`, not plausible `.ro` addresses.** `.example` (with `.test`,
 * `.invalid`, `.localhost`) is reserved by RFC 2606 for documentation and examples, so it provably
 * cannot resolve to a third party. That is the difference between *provably safe* and *probably safe*,
 * and it is the reason this file forbids the plausible form rather than merely preferring the safe one.
 *
 * **The identifiers stay deliberately un-checksumable.** Every CUI and CNP in the fixture fails to be a
 * real registered identifier. That is a safety property, not sloppiness: it means no fixture can ever
 * match a real taxpayer. The scan below is what stops a future edit from quietly minting one.
 *
 * **B-111 closed the disagreement this file used to record as a caveat.** `cnpCheckDigitValid` used to
 * compute `sum % 11` (10 → 1) — the **CUI** rule — while the canonical CNP rule is `(sum % 11) * 10 % 11`
 * (10 → 1). They are not two strengths of the same key: they map the residue to different digits, so a
 * value can satisfy one and not the other. The helper is now canonical, and the corrected rule moves
 * exactly two literals from "fails the arithmetic" to "passes the arithmetic, impossible on structure":
 *
 *   - `1234567890123` — the seed taxpayer's CNP, and the demo client CUI. Control digit lands; birth date
 *     decodes to month 45 / day 67, which no register contains.
 *   - `0123456789012` — a unit-fixture profile CNP (`schema.test.ts`, `store.snapshots.test.tsx`,
 *     `snapshots.test.ts`). Control digit lands; the leading `0` is not a legal sex digit and the day is
 *     34. **This one was not recorded anywhere before B-111** — it was passing the wrong guard, not a
 *     documented exception. It is pinned below rather than excused in prose.
 *
 * Neither is a real-looking person, because neither decodes to a date a register could hold — that is the
 * arithmetic-vs-structure distinction B-110 established and B-111 leaves standing. The set of
 * arithmetic-valid literals is asserted by name below, so a third one cannot arrive quietly and a fixed one
 * cannot linger in the list. The case where BOTH legs fail is the one already removed:
 * `1900101223344` in `src/domain/snapshots/hashSync.test.ts` — canonical control digit valid AND decodable
 * to a real 1990 birth date. A hashing fixture is not a person, and it is gone.
 *
 * What this file does NOT cover: `docs/`. Historical phase notes and audit records quote the old values
 * as the record of what was changed, and rewriting them would falsify that record. The record of this
 * pass is `docs/ai/phases/56_b110_fixture_identity_hygiene.md`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { fixedInstant } from '../test/fixedInstant';
import { pinClock, unpinClock } from '../test/clock';
import {
  cnpBirthDatePlausible,
  cnpCheckDigitValid,
  cnpControlDigit,
  cnpLooksReal,
} from '../test/occupancyFixtures';
import { getTaxEstimate } from './dashboard';
import { ron, type RonMoney } from '../domain/money';
import { seedData } from './seed';

afterEach(() => unpinClock());

/**
 * Every source in the project, read as text. `?raw` so the scan sees the bytes a future edit would
 * write, not a compiled form.
 */
const SOURCES = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '/e2e/**/*.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * This file is the one source allowed to name the forbidden values, because naming them is how it
 * forbids them. Excluded by exact path — not by directory, so a new file cannot inherit the exemption.
 */
const SELF = '/src/data/seed.identityHygiene.test.ts';

const scanned = Object.entries(SOURCES).filter(([file]) => file !== SELF);

// ── 1. No real third-party identifier survives anywhere in code ─────────────

/**
 * The old fixture identity, as patterns rather than bare strings, so a near-miss re-introduction
 * (`Popescu` in any position, the domain with or without the hyphen) is caught too.
 */
const BANNED: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'the demo taxpayer and every name built on it', pattern: /Popescu/i },
  { label: 'the demo client Marius Ionescu', pattern: /Marius Ionescu/ },
  { label: 'the unowned demo domain', pattern: /popescu-?consulting\.ro/i },
  { label: 'the unowned client domain presta.ro', pattern: /@presta\.ro/i },
  { label: 'a real Romanian mail provider used as a demo address', pattern: /@mail\.ro/i },
  { label: "Banca Comercială Română's name", pattern: /\bBCR\b/ },
  { label: "Banca Comercială Română's real BIC bank code", pattern: /\bBACX\b/ },
  { label: 'a real retailer used as a demo supplier', pattern: /Carrefour/i },
  { label: 'the demo supplier CloudHost', pattern: /CloudHost/i },
  { label: 'the demo supplier Office Supplies', pattern: /Office Supplies/i },
  { label: 'the demo client Presta Consulting', pattern: /Presta\s+Consulting/i },
  { label: 'the demo address', pattern: /Str\.\s*Libert[ăa][țt][ií]rii/ },
];

describe('B110 — no real third-party identifier survives in code', () => {
  it('the scan is not vacuous: it reads the fixture and the specs', () => {
    expect(scanned.length).toBeGreaterThan(20);
    expect(scanned.some(([file]) => file === '/src/data/seed.ts')).toBe(true);
    expect(scanned.some(([file]) => file.startsWith('/e2e/'))).toBe(true);
  });

  for (const { label, pattern } of BANNED) {
    it(`no source contains ${label}`, () => {
      const hits = scanned
        .filter(([, source]) => pattern.test(source))
        .map(([file]) => file);
      expect(hits, `${pattern} still present in: ${hits.join(', ')}`).toEqual([]);
    });
  }

  it('the replacement set is actually present in the shipped fixture', () => {
    const id = seedData.profile.identity;
    expect(id.nume).toBe('Dobre Radu');
    expect(id.denumire).toBe('Dobre Radu PFA');
    expect(id.email).toBe('radu@dobrestudio.example');
    expect(id.emailSocietate).toBe('contact@dobrestudio.example');
    expect(id.adresa).toBe('Str. Meșteșugului 12, Cluj-Napoca');
    expect(id.banca).toBe('Banca Carpatică');
    expect(id.contBancar).toBe('RO44 CARP 0000 0000 1234 5678 9000');
    // The three suppliers keep the three fates they were chosen to demonstrate.
    expect(seedData.expenses.map(e => e.furnizor)).toEqual([
      'Conectica SRL', // e1 — hosting/connectivity, `postal_and_telecom`, deductibilă
      'Coșul Zilnic SRL', // e2 — supermarket bon, `personal_or_family_use`, expres nedeductibilă
      'Papetaria SRL', // e3 — rechizite, deductibilă ca categorie dar exclusă de `status`
    ]);
    expect(seedData.expenses.map(e => e.category)).toEqual([
      'postal_and_telecom',
      'personal_or_family_use',
      'business_space_upkeep',
    ]);
    // r1/r4 bill the same company as c1; r2/r3 are natural-person clients.
    expect(seedData.revenues.map(r => r.client)).toEqual([
      'Codexa SRL',
      'Enache Sorin',
      'Barbu Cristina',
      'Codexa SRL',
    ]);
  });
});

// ── 2. Every email domain in fixture data is reserved ───────────────────────

/**
 * RFC 2606 reserves both whole domain names and top-level domains for documentation and examples.
 * A name under either provably cannot resolve, so a fixture address written on one can never reach a
 * third party.
 */
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'] as const;
const RESERVED_TLDS = ['.example', '.test', '.invalid', '.localhost'] as const;

function domainOf(address: string): string {
  return address.slice(address.indexOf('@') + 1).toLowerCase();
}

function domainIsReserved(domain: string): boolean {
  return (RESERVED_DOMAINS as readonly string[]).includes(domain)
    || RESERVED_TLDS.some(tld => domain.endsWith(tld));
}

/**
 * One production UI placeholder, not fixture data: the `email` input in `src/pages/Clients.tsx` hints
 * `email@exemplu.ro`. It is UI copy, outside this pass's boundary, and is listed as a residual in the
 * phase doc rather than silently swept up here.
 */
const ALLOWED_NON_RESERVED = new Set(['email@exemplu.ro']);

describe('B110 — every fixture email sits on a reserved domain', () => {
  it('no fixture source introduces an email on a domain we cannot prove is unowned', () => {
    const offenders: string[] = [];
    const seen = new Set<string>();
    for (const [, source] of scanned) {
      for (const m of source.matchAll(/['"]([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})['"]/g)) {
        const address = m[1];
        seen.add(address);
        if (ALLOWED_NON_RESERVED.has(address)) continue;
        const domain = domainOf(address);
        if (!domainIsReserved(domain)) offenders.push(address);
      }
    }
    expect(seen.size).toBeGreaterThan(5);
    expect([...offenders].sort()).toEqual([]);
  });

  it('the shipped fixture uses .example, and nothing was made to look more real', () => {
    const emails: Array<string | undefined> = [
      seedData.profile.identity.email,
      seedData.profile.identity.emailSocietate,
      ...seedData.clients.map(c => c.email),
      seedData.settings.company.email,
      seedData.settings.personal.email,
    ];
    for (const email of emails) {
      if (typeof email !== 'string') {
        throw new Error('the fixture is expected to record an email at each of these fields');
      }
      expect(domainIsReserved(domainOf(email))).toBe(true);
    }
  });
});

// ── 3. No fixture identifier can ever match a real taxpayer ─────────────────

/**
 * Two CUI control-digit keys are in circulation; a value that satisfies either one is treated as
 * real-looking. A CUI is 2–10 digits after the optional `RO`, which is itself a hard structural limit.
 *
 * The CUI family stays local on purpose: it is a different arithmetic over a different length, and
 * `occupancyFixtures.ts` is the CNP guard. B-111 is the reason the two are never allowed to share a helper
 * again — the bug was exactly a CUI formula wearing a CNP name.
 */
const CUI_KEYS = ['132765432', '123456789'] as const;

function cuiControlDigit(digits: string, key: string): number {
  const rest = digits.slice(1).split('').reverse().map(Number);
  const sum = rest.reduce((acc, d, i) => acc + d * Number(key[i % key.length]), 0);
  const rest11 = (sum * 10) % 11;
  return rest11 === 10 ? 0 : rest11;
}

function cuiLooksReal(value: string): boolean {
  const bare = value.replace(/^RO/i, '');
  if (!/^[0-9]{2,10}$/.test(bare)) return false;
  // An all-zero number satisfies the arithmetic trivially (control digit 0 against 0) and is the
  // null placeholder `RO00000000` that ~20 unit fixtures use for "a client that is not the point of
  // this test". It is not an assignable CUI, so it is not real-looking.
  if (/^0+$/.test(bare)) return false;
  return CUI_KEYS.some(key => cuiControlDigit(bare, key) === Number(bare[0]));
}

describe('B110 — no fixture identifier is a real registered identifier', () => {
  const cnpLiterals = new Set<string>();
  const cuiLiterals = new Set<string>();
  for (const [, source] of scanned) {
    for (const m of source.matchAll(/['"]([0-9]{13})['"]/g)) cnpLiterals.add(m[1]);
    for (const m of source.matchAll(/['"](RO[0-9]{6,14})['"]/g)) cuiLiterals.add(m[1]);
  }

  it('the scan finds the fixture identifiers, so it cannot pass on an empty set', () => {
    expect(cnpLiterals.has('1234567890123')).toBe(true);
    expect(cuiLiterals.has('RO4455667788990')).toBe(true);
  });

  it('every 13-digit fixture literal is not a real-looking CNP (canonical arithmetic + birth date)', () => {
    for (const value of cnpLiterals) {
      expect(cnpLooksReal(value), `${value} is a real-looking CNP`).toBe(false);
    }
  });

  it('the literals that DO satisfy the canonical control digit are pinned, and each is impossible on structure', () => {
    // B-111 reclassified exactly these two: they pass the corrected arithmetic and are safe only on their
    // decoded birth date. The set is asserted by name so that (a) a third arithmetic-valid literal cannot
    // arrive quietly, and (b) one that gets fixed cannot stay on the list as cover.
    const arithmeticValid = [...cnpLiterals].filter(cnpCheckDigitValid).sort();
    expect(arithmeticValid).toEqual(['0123456789012', '1234567890123']);
    for (const value of arithmeticValid) {
      expect(cnpBirthDatePlausible(value), `${value} decodes to a plausible birth date`).toBe(false);
    }
  });

  it('every RO-prefixed fixture literal fails to be a real CUI', () => {
    for (const value of cuiLiterals) {
      expect(cuiLooksReal(value), `${value} is a real-looking CUI`).toBe(false);
    }
  });

  it('the seed CUI is not a well-formed CUI at all: 13 digits where a CUI is 2–10', () => {
    // Stated as its own case because it is the one value whose control digit satisfies one of the two
    // published keys. It is safe on length, not on arithmetic, and a future edit that shortened it
    // would have to re-check the arithmetic.
    const cui = seedData.profile.identity.cui;
    expect(cui.replace(/^RO/i, '')).toHaveLength(13);
    expect(cuiLooksReal(cui)).toBe(false);
  });

  it('the guard itself computes the canonical CNP digit, not the CUI digit (B-111)', () => {
    // The defect was the helper, not a fixture, so the helper gets its own case. These two values are chosen
    // because the two rules disagree on them: `sum % 11` (the CUI rule) expects 8, `(sum % 11) * 10 % 11`
    // (the CNP rule) expects 3. A regression back to the CUI formula fails here on both directions.
    expect(cnpControlDigit('1234567890123')).toBe(3);
    expect(cnpCheckDigitValid('1234567890123')).toBe(true);
    expect(cnpCheckDigitValid('1234567890128')).toBe(false);
    // Both are structurally impossible — month 45 — so naming them here cannot mint a person.
    expect(cnpBirthDatePlausible('1234567890123')).toBe(false);
    expect(cnpBirthDatePlausible('1234567890128')).toBe(false);
  });

  it('the seed CNP satisfies the canonical control digit and decodes to an impossible birth date', () => {
    // B-111 changed which leg holds for this value: it never failed the arithmetic, it failed the CUI key.
    // What makes it provably not a person is the date — month 45, day 67 — and that is the distinction this
    // case exists to keep visible rather than re-assert a passing arithmetic check.
    const cnp = seedData.profile.identity.cnp;
    expect(cnpCheckDigitValid(cnp)).toBe(true);
    expect(cnpBirthDatePlausible(cnp)).toBe(false);
    expect(cnpLooksReal(cnp)).toBe(false);
  });
});

// ── 4. Names are not amounts: the money and the calendar are frozen ─────────

/**
 * The seed's amounts and dates, pinned independently of the identity. B110 changed names only. If any
 * figure here moves, something other than a name moved. Amounts are written in lei through `ron()`,
 * the same call the seed uses, so the pinned value is the currency-carrying amount and never a bare
 * integer that could be read as lei or as bani.
 */
const PINNED_RECORDS: ReadonlyArray<{ id: string; date: string; net: RonMoney; vat: RonMoney }> = [
  { id: 'r1', date: '2026-02-02', net: ron(4500), vat: ron(945) },
  { id: 'r2', date: '2026-04-10', net: ron(1200), vat: ron(252) },
  { id: 'r3', date: '2026-06-18', net: ron(800), vat: ron(168) },
  { id: 'r4', date: '2026-09-25', net: ron(3200), vat: ron(672) },
  { id: 'e1', date: '2026-03-05', net: ron(120), vat: ron(25.2) },
  { id: 'e2', date: '2026-05-12', net: ron(85.5), vat: ron(17.96) },
  { id: 'e3', date: '2026-07-20', net: ron(340), vat: ron(71.4) },
];

describe('B110 — the rename moved no amount and no date', () => {
  it('every seed record still carries its pinned date and amounts', () => {
    const records = [...seedData.revenues, ...seedData.expenses];
    expect(records).toHaveLength(PINNED_RECORDS.length);
    for (const pinned of PINNED_RECORDS) {
      const found = records.find(r => r.id === pinned.id);
      expect(found, `${pinned.id} is missing from the seed`).toBeDefined();
      expect(found!.date, `${pinned.id} date moved`).toBe(pinned.date);
      expect(found!.valoareFaraTva, `${pinned.id} net moved`).toEqual(pinned.net);
      expect(found!.tva, `${pinned.id} VAT moved`).toEqual(pinned.vat);
    }
  });

  it('the seed estimate is still exactly 311.200 bani', async () => {
    pinClock(fixedInstant());
    const estimate = await getTaxEstimate(seedData, '2026-10-31');
    if (estimate.status !== 'computed') throw new Error('the seed register must still compute');
    expect(estimate.output.total).toBe(311200);
  });
});
