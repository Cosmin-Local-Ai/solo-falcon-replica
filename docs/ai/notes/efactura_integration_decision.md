# e-Factura integration — decision and the rule it depends on

**Status: decision made, rule UNVERIFIED, nothing built.** Recorded 2026-10-08 while Phase 9b runs.
No code, no researcher (operator chose to keep the deadline work clean first).

## 1. Decision — model B

**Silent integration with an internal working-day SLA and exception-only surfacing.**

- The platform **transmits to ANAF automatically** on invoice emission.
- **Nothing appears in the UI on success.** No deadline card, no permanent presence — the operator was
  explicit that a standing e-Factura entry is noise.
- A card appears **only on exception**: transmission pending, rejected, or failed.
- An **internal SLA timer** runs underneath, and fires only if *we* have not transmitted inside the term.
  Its purpose is to catch our own gaps, not the user's: invoices imported from outside the platform,
  offline periods, an expired ANAF certificate, a rejected XML.

**Why the deadline stops being a user deadline.** Once transmission is automatic, the statutory term can
only be breached by a failure of ours. So it is an SLA, not a `Deadline`. It must **not** enter the
`DeadlineEventType` union or the deadline table — that table is for obligations the *user* must act on,
and Phase 9b exists precisely to stop us emitting rows nobody can act on.

**Rejected:** a permanent e-Factura deadline card (noise), and modelling it as a recurring calendar
deadline (invents dates the law does not set).

## 2. The rule as supplied by the operator — **UNVERIFIED**

Two bounds, and the effective deadline is the **earlier** of them:

1. **From emission:** transmit within **5 working days** of the invoice issue date.
2. **From the invoice-issue deadline:** never later than **5 working days** after the last date the
   invoice itself could lawfully have been issued.

The second bound comes from **CF (Legea 227/2015) art. 319 alin. (16)**: an invoice must be issued
**până în a 15-a zi a lunii următoare** livrării/prestării.

**Day-counting rules as supplied:**

- The first day counted is the **working day immediately following** emission — emission day is day 0.
- **Weekends and public holidays are not counted.**
- If the term would expire on a non-working day, it **extends to the next working day**.

So for a delivery on 2026-03-10: invoice may be issued to 2026-04-15; if issued 2026-04-15, the
transmission bound is 5 working days after that, skipping weekends and holidays.

### Confidence: **low — treat as a claim, not a citation**

Nothing here has been read from primary text by this project. Specifically unverified:

| Claim | What must be checked |
|---|---|
| 5 working days from emission | **OUG 120/2021 art. 10 alin. (7)** — the actual number, and whether it is *zile lucrătoare* or *zile calendaristice*. **This project has been wrong twice on exactly this distinction.** Note also that this term has been amended repeatedly and there have been temporary prorogations; the 2026 value must be read from the current consolidation, doc **310662**. |
| „nu mai târziu de 5 zile lucrătoare de la data-limită din Codul Fiscal" | Whether this second bound is in the e-Factura act, in the CF, or is a practitioner gloss. **This is the load-bearing one for the model** — if it is not statutory, the double bound should not be encoded. |
| CF art. 319 alin. (16) → 15th of following month | Art. 319 alin. (16) numbering and wording in the **2026** consolidation (doc 312601). Art. 319 has been amended often; the alineat number is exactly the kind of thing that drifts. |
| Extension to next working day | Whether that is the e-Factura act's own rule or **CPF (Legea 207/2015)** general computation of terms. If the latter, it applies to *all* our deadlines, not just this one — which would be a significant finding for Phase 9b's date semantics. |

**Do not encode any of it until it is read from primary text.**

## 3. The dependency this creates that the repo does not have

**A Romanian public-holiday calendar.** Every counting rule above is working-day arithmetic, and the
existing deadline engine does **calendar** offsets — `offsetDays` on a `FiscalRule`, `monthEnd()`,
nothing holiday-aware anywhere in `src/domain/`.

So model B needs:

- a holiday set for the fiscal year, with legal basis (**Codul muncii art. 139** lists the public
  holidays; each year's list is stable but the numbering should be verified, not assumed);
- a `nextWorkingDay` / `addWorkingDays` primitive, with the day-0 convention above made explicit and tested;
- a decision on where holidays live — they are **law-derived data**, so they belong in the 2026 rules
  package like any other rule, not as a hardcoded array. Phase 9b's central finding was that hardcoded
  date arrays are what let twelve fabricated deadlines ship.

**This is the real cost of model B**, and it is larger than the UI work. It is also reusable: if the
„extends to the next working day" rule turns out to be the CPF's general term-computation rule, it
applies to `d212_filing` and `vat_registration` too — and `vat_registration` has `offsetDays = 0`, so
it would be unaffected, but a future event-relative rule would not be.

## 4. Not researched, and required before any of this is buildable

Automatic transmission is an **integration**, not a display of a rule. This repo has researched none of:

- ANAF access: SSO, the **client certificate** requirement, and who provisions it;
- the RO e-Factura REST endpoint, its auth flow, and its validation errors;
- the **CIUS/RO e-Factura XML** format and what our invoice model would have to carry to produce valid XML;
- what a rejected transmission looks like, since the entire UI of model B is built on surfacing those.

Treat these as the critical path for any e-Factura milestone. The legal rule is the easy half.

## 5. Open questions to carry forward

| ID | Question |
|---|---|
| **Q-EFACT-TERM** | art. 10 alin. (7): the real term, and *lucrătoare* vs *calendaristice*, from doc 310662 |
| **Q-EFACT-DOUBLE-BOUND** | Is the „not later than 5 working days from the CF invoice deadline" bound statutory, and in which act? |
| **Q-CF-319-16** | art. 319 alin. (16) numbering and the „a 15-a zi" rule in the 2026 CF consolidation |
| **Q-TERM-COMPUTATION** | Is next-working-day extension the e-Factura act's rule or CPF general term computation? **If CPF, it applies to every deadline we model** — highest blast radius on this list |
| **Q-HOLIDAY-SET** | Authoritative Romanian public-holiday list and its legal basis |
| **Q-EFACT-API** | ANAF authentication, certificate, endpoint, XML schema, rejection semantics |
