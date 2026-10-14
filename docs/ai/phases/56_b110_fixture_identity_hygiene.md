# 56 — B110: fixture identity hygiene

**Scope:** replace the identifiers in the demo/seed data that belong to, or could belong to, real third
parties. Fixture content only — no data-shape change, no chain step.

**Baseline measured at `2bb13d0`; work done from `855bde2`.**

---

## 1. What was actually wrong

Three real-world hooks in the shipped fixture. In order of severity:

1. **An IBAN built on a real bank's BIC prefix.** `identity.banca` read `BCR` and `identity.contBancar`
   read `RO44 BACX 0000 0000 1234 5678 9000`. `BACX` is Banca Comercială Română's real BIC bank code, so
   the fixture showed a real-format IBAN for a bank it also named by its real abbreviation. This was the
   worst of the three precisely because it was *plausible*: a real bank, a real identifier format, and a
   number that looks like it could belong to someone. It appeared in three places — `profile.identity`,
   the legacy `settings.company` block, and `settings.bankAccounts`.
2. **A real retailer's trademark** — `Carrefour` — shown as the supplier on a demo expense.
3. **A domain we neither own nor verified** — `popescuconsulting.ro` — in two demo email addresses.

## 2. The replacement set

Used exactly as specified in the brief's table. `src/data/seed.ts` is the only production author of
these values; every other hit was a test-local copy or an assertion pinning the seed.

| Field | Was | Now |
|---|---|---|
| `identity.nume` | `Popescu Andrei` | `Dobre Radu` |
| `identity.denumire` | `Popescu Andrei PFA` | `Dobre Radu PFA` |
| `identity.email` | `andrei@popescuconsulting.ro` | `radu@dobrestudio.example` |
| `identity.emailSocietate` | `contact@popescuconsulting.ro` | `contact@dobrestudio.example` |
| `identity.adresa` / `adresaSocietate` | `Str. Libertății 12, Cluj-Napoca` | `Str. Meșteșugului 12, Cluj-Napoca` |
| `identity.banca` | `BCR` | `Banca Carpatică` |
| `identity.contBancar` | `RO44 BACX 0000 0000 1234 5678 9000` | `RO44 CARP 0000 0000 1234 5678 9000` |
| revenue `client` (r1, r4) / `clients.c1` | `Presta Consulting SRL` | `Codexa SRL` |
| revenue `client` (r2) / `clients.c2` | `Andrei Popescu` | `Enache Sorin` |
| revenue `client` (r3) / `clients.c3` | `Marius Ionescu` | `Barbu Cristina` |
| expense `furnizor` (e2) | `Carrefour` | `Coșul Zilnic SRL` |
| expense `furnizor` (e1) | `CloudHost SRL` | `Conectica SRL` |
| expense `furnizor` (e3) | `Office Supplies SA` | `Papetaria SRL` |
| `documents.doc3.nume` | `Contract Presta Consulting.pdf` | `Contract Codexa.pdf` |

**The three suppliers keep the three fates they were chosen to demonstrate.** The new test asserts the
supplier list and the category list together, so a future edit cannot swap them without failing:
`Conectica SRL` is the hosting/connectivity bill that classifies `postal_and_telecom` and is deductibilă;
`Coșul Zilnic SRL` is the supermarket bon that is expressly non-deductible as personal/family use
(CF art. 68 alin. (7) lit. a)); `Papetaria SRL` is the rechizite invoice, deductible as a category but
excluded anyway by `status: 'respinsa'`.

**Emails beyond the table, required by acceptance 6.** The table covered only `popescuconsulting.ro`.
Acceptance 6 requires *every* email domain in fixture data to be reserved or owned, and four more were
neither: `presta.ro` (client c1, and the edited-value variant in the save/edit suites), `mail.ro`
(a real Romanian mail provider, used for two natural-person demo clients), `popescu-consulting.ro`
(the hyphenated variant in `src/domain/snapshots/hashSync.test.ts`), and `test.ro` (in
`src/data/store.migration.test.ts`). These became `contact@codexa.example`, `nou@codexa.example`,
`sorin@enache.example`, `cristina@barbu.example`, `contact@dobrestudio.example`, `company@example.test`
and `personal@example.test`.

**The TASK 9 reasoning survives.** The comments in `src/data/seed.ts` that record why this profile is a
PFA and not an SRL, why a PFA's trading name is the person's own name, and why `numarRegComert` stays
because a PFA *is* registered at ONRC, are unchanged in substance; only the names inside them moved.
Four comments in the test suites recorded the TASK 9 re-pin by quoting the old literal
(`src/pages/Settings.test.tsx`, `src/App.test.tsx`, `e2e/dashboard.spec.ts`, `e2e/settings.spec.ts`).
Rewriting the quoted literal would have falsified the record, so those comments now describe the change
without naming the retired value.

## 3. Why `.example`, and why it was not made to look "more real"

`.example` (with `.test`, `.invalid`, `.localhost`) is reserved by RFC 2606 for documentation and
examples, and `example.com` / `example.net` / `example.org` are reserved as whole domain names. A name
under any of them provably cannot resolve to a third party. That is the difference between *provably
safe* and *probably safe*, and it is why the new test **forbids** the plausible form rather than merely
preferring the safe one.

## 4. The invalid checksums — a safety property, now tested, with two honest corrections

The brief states that every CUI and CNP in the seed fails its own check digit, and asks that this be
preserved and tested. It is now tested — but the premise is only partly true, and the corrections matter
more than the test.

**Correction 1 — the seed CNP passes the canonical CNP check digit.** Two formulations are in circulation
in this repository and they disagree:

- `src/test/occupancyFixtures.ts cnpCheckDigitValid` computes `sum % 11` (10 → 1).
- The canonical CNP rule is `(sum % 11) * 10 % 11` (10 → 1).

For `1234567890123` the weighted sum is 261. `261 % 11 = 8`, which is the figure the brief quotes
("expects 8 and has 3"). But `(261 % 11) * 10 % 11 = 3`, and the thirteenth digit **is** 3 — so under the
canonical rule the control digit matches. The house helper rejects it only because it omits the ×10 step.

The fixture is still safe, for a different reason than the brief claims: the value decodes to sex digit 1,
year 23, **month 45, day 67**, a birth date no register contains. So it cannot be anyone's real CNP — but
on structure, not on arithmetic. The new test therefore checks both, and fails a value that passes either
test alone. **The discrepancy in `cnpCheckDigitValid` is left unfixed**: it is a test-only helper, it is
outside this brief's boundary, and changing its arithmetic would silently change what the occupancy
privacy guard accepts. It is handed forward as a finding.

**Correction 2 — the seed CUI passes one published CUI key variant.** `RO4455667788990` has control digit
4. Under key `132765432` the expected control digit is 5 (the brief's figure); under key `123456789` it is
4, i.e. it matches. It is safe because a CUI is 2–10 digits after the optional `RO` and this is 13 — a
structural impossibility, not an arithmetic one. The brief's "has 0" also mis-states the actual control
digit, which is the leading 4; the trailing 0 is not the control digit. The new test pins the length
argument explicitly, so a future edit that shortened the value would have to re-check the arithmetic.

**What the new guard found, and what was changed for it.** Scanning every fixture source for
identifier-shaped literals turned up three values that *were* real-looking and had never been noticed:

| File | Was | Why it was a problem | Now |
|---|---|---|---|
| `src/domain/snapshots/hashSync.test.ts` | `1900101223344` | canonical control digit valid **and** decodes to 1990-01-01 — a real person's CNP sitting in a hashing fixture | `1999999223345` (fails both variants, impossible birth date) |
| `src/data/dashboard.coverage.test.ts` | `RO90000002` | control digit valid under **both** published CUI keys | `RO90000003` (fails both) |
| `src/pages/Settings.data.test.tsx` | `RO00000001` | control digit valid under both published CUI keys | `RO00000002` (fails both) |

None of the three values is asserted anywhere; only its presence on the record matters, so the
replacement moves no assertion.

**Deliberately not changed:** `RO00000000`, the all-zero placeholder roughly twenty unit fixtures use for
"a client that is not the point of this test". It satisfies the arithmetic trivially (0 against 0) and is a
null placeholder rather than an assignable number. The guard names this exemption in a comment instead of
pretending the value is arithmetic-safe.

## 5. Hashes and digests — **none were re-pinned, because none exist over the identity**

The brief predicted `src/domain/snapshots/hashSync.test.ts` would pin a digest over the identity and
would need re-pinning. **It does not.** Read in full: its assertions are all *relative* —
`computeInputsHashSync(input)` equals `await computeInputsHash(input)`, order-independence against
`canonicalize`, and sensitivity to a profile gaining a key. No hex constant depends on the identity.

A repo-wide scan for long hex literals in `src/` and `e2e/` returns exactly one: the NIST SHA-256 test
vector for `"abc"` in the same file, which is unaffected. There are no `.snap` files and no
`__snapshots__` directories. Other `inputsHash` assertions compare a stored digest against a freshly
computed one, which is also relative.

**Result: zero digests re-pinned, zero assertions weakened or removed.** This is reported as a deviation
from the brief's expectation rather than as a clean pass, because the brief treats the re-pin as the
dangerous part of the task and it turned out not to exist.

## 6. Two behaviours the name actually drives (found, not assumed)

The name is not inert text. `src/App.tsx` derives the avatar initials from the first two tokens of
`identity.nume`, and `src/domain/profile.ts greetingName` takes the **last** token as the given name
because this dataset stores names surname-first. Renaming therefore moved:

- initials `PA` → `DR` in `src/App.test.tsx`;
- the greeting `Bună, Andrei` → `Bună, Radu` in the same file.

The same test used to guard against a stale hardcoded identity by querying for the retired person's name
and initials. The name literal is gone; the guard is stronger than it was, because it now asserts that
the *previous* seed's initials (`PA`, and the older `PI`) are absent — which is what would actually catch
a shell that stopped deriving and went back to a constant.

## 7. What was deliberately left alone

- **The product name.** `index.html`'s `<title>SOLO — Contabilitatea fără griji</title>` and the tagline
  are out of scope by explicit decision. A later pass owns them. `git diff` shows `index.html` untouched.
- **`mentiuniFactura: 'Mulțumesc pentru colaborare.'`** — an ordinary Romanian phrase, no exposure.
- **`caen: [{ cod: '6201', … }]`** — a real CAEN code, and it should be real.
- **`numarRegComert: 'J40/1234/2026'`** — real format, and the format is load-bearing for
  `pfaStartYear: 2026`. See the residuals below.
- **`telefon: '0750 123 456'`** and the client phone numbers. See the residuals below.
- **Typed-in values in onboarding and settings specs** (`Ionescu Maria`, `Georgescu Maria`). These are a
  simulated person typing their own name, not fixture identities, and none is a table value.
- **`email@exemplu.ro`** — the placeholder on the `email` input in `src/pages/Clients.tsx`. It is UI copy,
  not fixture data, and page copy is outside this brief's boundary. The new guard allow-lists it by exact
  address with a comment saying so, rather than quietly passing over it. It is listed as a residual.

## 8. Residuals that cannot be proven safe — pre-release checks, not handled items

These are **not** resolved by this pass. They are listed honestly because no checksum and no reserved TLD
covers them:

1. **`Banca Carpatică` and the `CARP` token.** The one name in the replacement table that cannot be proven
   unclaimed. It is a coinage and it is not a bank this worker could identify, but "not recognised" is not
   "not claimed". **Pre-release: check the Romanian trade register and the ONRC/BNR bank registers for
   `Banca Carpatică` before shipping.**
2. **`telefon: '0750 123 456'`, and the client numbers `0721 111 222`, `0731 333 444`, `0742 555 666`.**
   A phone number cannot be proven unassigned the way a checksum or a reserved TLD can. These are ordinary
   mobile-format numbers and at least one may reach a real subscriber. **Pre-release: either confirm them
   unassigned or move them into a range ANCOM reserves for drama/fiction.**
3. **`J40/1234/2026`.** A plausible ONRC registration format. The format is load-bearing and the value was
   left, but it could correspond to a real registration. **Pre-release: check it does not resolve.**
4. **`email@exemplu.ro`** in `src/pages/Clients.tsx` — a `.ro` domain suggested to users as an example.
   Self-labelling in Romanian, but not RFC 2606 reserved. Owned by the later UI-copy pass.
5. **`RO24ABCDEFTREASURABANK001`** in `src/domain/snapshots/hashSync.test.ts` — a self-labelling fake bank
   code inside an IBAN-shaped string. Left because it announces itself as fake, but it is not a reserved
   format and is noted for completeness.

## 9. Deviations from the brief, in one place

- **The brief contradicts itself on the replacement set.** The section heading says *"User decision,
  2026-10-13: companies are famous real ones — Google/Microsoft for clients, S&P 500 names for bills"*,
  while the table immediately below it, and the prose under that, specify invented Romanian coinages. The
  two most recent commits on this branch (`7cd6a14`, `687c66a`) revise brief 60 toward invented-but-
  relatable Romanian names, and the task instruction says to use the table. **The table was used.** The
  stale heading line is flagged rather than silently corrected.
- **The checksum premise is partly wrong** — see §4. Both corrections are documented and the safety
  property is preserved by a different argument than the brief used.
- **No digest needed re-pinning** — see §5.
- **Scout classification was verified, not trusted.** The scout reported `hash-or-digest-pin = 0` across
  all sixteen strings. That was independently re-checked against the tree before acting.
- **Two transcript payloads arrived posing as reports and were in fact pi-lens skill documents**
  (`pi-lens-ast-grep`, then `pi-lens-lsp-navigation`). Both were unsolicited and discarded; no repository
  work was performed in response to either.

## 10. Verification

| Check | Baseline at `2bb13d0` | After |
|---|---|---|
| `npx tsc --noEmit` | 0 | **0** |
| Unit tests | 147 files / 2274 tests | **148 files / 2298 tests, all passing** |
| `npm run build` | 0 | **0** (pre-existing chunk-size warning only) |
| `npm run test:e2e` | 154 | **154 passed**, including the live `/settings#!/fiscal` axe scan |
| Copy-guard `ALLOW_LIST` | empty | **empty** |
| Seed estimate | 311.200 bani | **311.200 bani — unchanged, not re-pinned** |
| Chain head | v21 (`document-blob-ref`) | **v21 — `migration.ts` untouched, no chain step** |
| Rule package | release 5, 54 rules | **release 5, 54 rules — no rule file in the diff** |

The unit count moves by exactly the one new file and its 24 tests. **No existing test moved**: no
assertion was re-baselined, weakened or deleted anywhere in this pass.

**Boundaries respected.** `git diff` touches no rule file, no `migration.ts`, no `schema.ts`, no
`index.html`, no `domain/date.ts`, no `vatPeriodicity.ts` / `vatReturn.ts`, and no non-test file under
`domain/fx/`. The only file under `domain/fx/` in the diff is `ledger.test.ts`, whose single changed line
is a client fixture name.

**No amount and no date moved.** Every changed line in `src/data/seed.ts` pairs with a counterpart that
differs only in the name — dates, `valoareFaraTva`, `tva`, `cui`, `status`, `category` and `nr` are
byte-identical. This is now pinned independently of the identity by a test that asserts each seed record's
pinned date and currency-carrying amounts, and re-asserts the 311.200 bani estimate.

**Residual grep.** Every old value from the table returns **zero hits outside `docs/`**, in source, tests,
e2e and the built `dist/` bundle. `git grep` for `\bBCR\b` outside `docs/` returns nothing. The values
survive only in `docs/ai/briefs/`, `docs/ai/PHASE_PLAN_11_34.md`, `docs/ai/notes/p7_worker_notes.md`,
`docs/QA-CLIENTS.md`, `docs/FINAL-AUDIT.md`, earlier phase docs and `docs/ai/steps/` — the record of what
was changed, which rewriting would falsify. `docs/ai/steps/` is never touched by policy.

## 11. The new guard

`src/data/seed.identityHygiene.test.ts` — 24 tests, four groups:

1. **No real third-party identifier survives in code.** Every source under `src/` and `e2e/` is read as
   raw text and scanned for the retired values as *patterns*, so a near-miss re-introduction is caught.
   This file is exempted by exact path, because naming the values is how it forbids them; the exemption is
   not inherited by any other file. The scan asserts it is not vacuous before it asserts it is clean.
2. **Every fixture email sits on a reserved domain**, checked against the RFC 2606 domain names and TLDs,
   with the one UI placeholder allow-listed by address.
3. **No fixture identifier is a real registered identifier.** Every 13-digit literal in the tree is checked
   against the house CNP helper *and* against the canonical arithmetic plus a decodable birth date; every
   `RO`-prefixed literal is checked against the length rule and both published CUI key variants.
4. **The rename moved no amount and no date**, and the seed estimate is still exactly 311.200 bani.

## 12. Handed forward

- **`cnpCheckDigitValid` in `src/test/occupancyFixtures.ts` omits the ×10 step** of the canonical CNP
  algorithm. It is the guard the occupancy privacy suite relies on to prove its fixtures are fake, and
  under the canonical rule it can call a real-looking CNP fake. Out of scope here; it should be reconciled
  deliberately, not as a side effect.
- The residuals in §8 are pre-release checks, not closed items.
- The product name remains deferred to its own pass.
