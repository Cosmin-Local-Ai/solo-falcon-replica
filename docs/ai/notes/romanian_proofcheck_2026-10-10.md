# Romanian proof-check — second pass over all user-facing text (2026-10-10)

**Source:** an external Romanian-language and user-facing clarity audit of current `master`, beyond the nine wording calls already settled in `USER_DECISIONS.md` D-LANG-2.
**Verification:** every concrete claim below was re-checked in-tree by the Orchestrator on 2026-10-10. **All of them reproduce.** File:line evidence is mine. Where the report *infers* something it could not see (whether an integration exists elsewhere), that is marked.

**The framing that matters:** this is not a spelling pass. Three of the findings are about the app **claiming things it did not do**, and one is an internal identifier reaching a Romanian sentence. Those outrank every grammar item.

---

## 1. Definite language errors — all confirmed

| Where | Current | Correct | Evidence |
|---|---|---|---|
| Form validation | `An invalid (2000–2100).` | `Anul trebuie să fie între 2000 și 2100.` | `ui/copy/common.ts:103` — partly English, in the copy layer the guard watches |
| Legislație | `Nu recalcalează pragurile…` | `Nu recalculează pragurile…` | `ui/copy/dashboard.ts:252` (and pinned in `LegislationSection.test.tsx:112`) — the second reviewer flagged the same typo independently |
| Declaration status | `Transmisa` | `Transmisă` | `ui/copy/records.ts:286` |
| Revenue deletion | `${nr} a fost ștearsă` | `Documentul ${nr} a fost șters.` | agreement assigned to a bare reference with no noun |
| File upload | `„${name}" a fost încărcat` | `Fișierul „${name}” a fost încărcat.` | mismatched quote pair **and** the noun problem |
| File deletion | `„${name}" a fost șters` | `Fișierul „${name}” a fost șters.` | same |

**One field changes meaning with the selected status.** `Detaliu status` appears whenever a record is not `Înregistrată`, and its placeholder is always the rejection-motiv text — including when the status is `În așteptare`. So the form asks the user to explain a rejection that has not happened. Fix: `Detalii privind starea` with a generic `Adaugă detalii…`, or a status-specific placeholder.

---

## 2. Formal and informal address are mixed — confirmed

The app mostly uses *tu* (`Caută client…`, `Adaugă client`, `Verifică datele din formular`) but several strings use *dumneavoastră*:

- `Facturi și notele fără factură emise de către dvs.` — `records.ts:15`
- `Adăugați primul venit pentru a-l vedea aici.` — `records.ts:21`
- `Adăugați prima cheltuială pentru a o vedea aici.` — `records.ts:57`
- `…clienți înregistrați în evidența dvs.` — `records.ts:205`

**Ruling recorded with this report:** informal throughout, because the product is personal financial management and most of it already leans that way. The goal is not casual — it is that one voice wrote the whole app.

---

## 3. Wording that reads as internal research notes rather than help

- `Faptă consemnată, fără efect juridic cunoscut.` (pension-suspension months) → proposed: **„Aplicația înregistrează lunile în care pensia a fost suspendată, dar nu folosește această informație pentru a modifica estimarea fiscală."** — *conditional on it accurately describing the implementation, which it does: `pensionSuspensionYears` is recorded and no consequence is drawn, because research 25 gap 1 is UNVERIFIED.*
- `Este o faptă din anul precedent, nu a acestui an.` → **„Se referă la opțiunea exercitată în anul precedent, nu în anul fiscal curent."** Explain what the field is instead of calling it a *faptă*.
- Notes that sound translated or academic, with proposed plainings: `supraviețuiește unui an cu venit zero` → `rămâne aplicabilă într-un an…`; `un fapt pe care aplicația nu îl deține` → `o informație de care aplicația nu dispune`; `nicio sursă primară nu le împacă` → `nicio sursă oficială verificată nu clarifică ce regulă are prioritate`. **Constraint the report states and I keep:** the last one must still say the sources have not resolved the conflict. Making it readable must not make it look resolved.
- Longer legal notes should split **practical conclusion** from **detailed explanation and citation** — the same three-level pattern the first audit recommended for thresholds.

---

## 4. An internal identifier reaches a Romanian sentence — confirmed, and it is the copy guard's blind spot

`src/domain/thresholds.ts:834`:

```ts
reviewReason: `Baza „${spec.requiredFiscalBase}” nu a fost furnizată; pragul nu poate fi evaluat.`,
```

`requiredFiscalBase` is an internal English key — `net-income`, `revenue-excl-vat` — so a user can be told *Baza „net-income” nu a fost furnizată*. The related weakness is already on our books: `FiscalThreshold.affectedDomain` is an open `string`, and `ThresholdSection.tsx:92` keeps a `?? t.affectedDomain` fallback that can print a raw key such as `pfa-revenue` (`phases/21_language_layer.md` §13 recorded exactly this).

**Why the guard missed it:** `copy.guard.test.ts` scans `src/components/**` and `src/pages/**`. A sentence assembled in `src/domain/` is outside its reach by design — domain sentences are computed legal facts and live where they are produced. **The fix is not to move them**; it is to extend the check to domain-generated message templates and to map every fiscal base to a Romanian label before the message is built (`net-income` → `venit net din activitate`, `revenue-excl-vat` → `cifră de afaceri, fără TVA`), with the labels following what the base *means in the engine*, not a word-for-word translation.

Recorded as **B-55**.

---

## 5. The documents section still teaches filings this profile does not make — confirmed

`ui/copy/records.ts:316` `Declarația 100 / impozit pe venit`, `:321` `Declarația 220 / contribuții sociale`, `:360` placeholder `ex. D101, D112, D200, 220, 221…`, `:372` `Înregistrează aici declarațiile fiscale depuse (D101, D112, 220, 221…)`.

This is the same error TASK 9 removed from the **seed** — D100 and D220 are not obligations for this profile (CF art. 120 / 120¹ abrogated by OUG 128/2024 from 01-01-2025; art. 122 alin. (3) is one annual D212). The seed was fixed; **the copy that teaches the workflow was not.**

Two acceptable resolutions, and the choice is a product one: show only the forms relevant to the current workflow, or describe the section explicitly as a general archive that may also hold historical documents. For a PFA starting in 2026 the first is cleaner. **Any change here needs the fiscal researcher to confirm the form list against the profile and fiscal year** — it is terminology with legal content, not decoration.

---

## 6. A hard-coded 2025 default — confirmed

`src/pages/Declarations.tsx:25` `an: initial?.an ?? 2025`, and `:67` offers `[2023, 2024, 2025, 2026]`. Against a product that starts in 2026, a new declaration defaulting to 2025 is an inherited default, not a decision. At minimum the default should be the active fiscal year; if older years are deliberately supported as an archive, that should be stated.

---

## 7. Claims broader than they should be

- **Intra-community VAT code:** `Firmele neplătitoare de TVA care vor colabora cu firme din Uniunea Europeană au nevoie de acest cod special.` reads as though *any* collaboration with an EU business requires it. ANAF's rules on registrul RO e-Factura / evidenta operatiunilor intracomunitare set out particular operations. **Needs the researcher to narrow it** — this is a legal-scope claim in a hint line.
- **Foreign-currency expense warning:** `într-o monedă pe care aplicația nu o poate aduce încă în lei, deci nu intră în cheltuielile deductibile.` The scope is understated: the record is also absent from the **lei totals**, which is exactly defect B-37. Proposed wording — *„Această cheltuială este în valută și nu este inclusă în totalurile calculate în lei, deoarece nu există încă un curs de conversie înregistrat."* — with the deductibility consequence stated separately. **Do not adopt it until PG-7 makes it true**; today the sentence and the aggregation disagree.
- **File-size error:** `Fișierul depășește X MB — stocarea locală nu e suficientă.` attributes the rejection to storage capacity when the app enforces an upload limit. Say what happened: `Fișierul depășește limita de încărcare de X MB.`

---

## 8. Terminology to standardise

`YTD` → `De la începutul anului`; `În progres` → `În curs`; `Detaliu status` → `Detalii privind starea`; `Status` → `Stare`; `Rapoarte de mișcări de trezorerie (RJIP) — generat…` — plural noun with a singular participle, and the register's official Romanian name should be checked before the label is final; `Nicio verificare de completitudine` → a user-centred sentence that says what the state actually means.

---

## 9. The one that is not a language problem — recorded as B-56

The report's caution is right, and in-tree it is worse than cautious:

- `ui/copy/records.ts:248-249`: `Declarația ${perioada} a fost transmisă` and a `Transmite` button. The action behind it is `store.tsx:93` / `:320` `sendDeclaration`, which **mutates local state**. There is no transmission.
- `ui/copy/settings.ts:61-62`: `Conectare e-Factura` and `Contul este conectat la platforma e-Factura`. There is no e-Factura integration — Q-EFACT-INTEGRATION records the model and Q-EFACT-API records that the API work is not even started.

The report says it cannot conclude from page files alone whether an integration exists elsewhere. **I checked: it does not.** `sendDeclaration` is a `setData` call.

**For a financial app this outranks every grammar item.** A user who believes a declaration was filed may not file it. The UI must distinguish, in words a user can trust:
1. a record saved locally;
2. a simulated or placeholder action;
3. an operation genuinely confirmed by an external service.

Until an integration exists, the honest wording is *marcată ca transmisă în aplicație* / *nu am transmis nimic către ANAF*, not *a fost transmisă*. **B-56.**

---

## 10. What the proof-check task must cover, and the order

Checks: Romanian correctness; one consistent voice; no internal research language; **no internal identifiers in any dynamic or fallback message**; every message accurate about what the app calculated, stored, excluded, validated or submitted; fiscal terminology verified against official sources; and every dynamic variant — plural forms, gender, statuses, missing data, invalid dates, rejected records, unavailable calculations, notification paths.

Order: **(1)** the false-success wording (B-56) and the identifier leak (B-55); **(2)** the definite errors in §1; **(3)** the stale D100/D220 teaching and the 2025 default; **(4)** voice and terminology; **(5)** the legal notes' readability, last, because they carry legal meaning and must not be simplified into a wrong claim.

This is Phase 28 / PG-12 work, and it needs a **guard that covers domain-generated messages**, not only `src/ui/copy/`.
