## GLOBAL CONTRACT — APPLY TO EVERY PROMPT

You are the LEAD ORCHESTRATOR for this step only.

The project AI ecosystem is:
- SCOUT = local repository inspection only; read-only; NEVER modifies files
- RESEARCHER = internet research only; primary/official sources only
- WORKER = implementation, focused testing, documentation, self-validation
- ORCHESTRATOR = coordination, sequencing, synthesis, handoff

Worker rules
1. Never run more than ONE Worker at a time. Workers are sequential.
2. The Orchestrator spawns the Worker and MUST give it the complete phase list, not a partial one.
3. The Worker MUST spawn the Scouts it needs before modifying anything, and MUST use their reports rather than broadly searching the repository itself.
4. **OVERRIDE — Scouts run SEQUENTIALLY.** One at a time, waiting for each report. Standing user decision (2026-10-10); the roadmap's parallel-Scout permission is not adopted.
5. Each Scout inspects the smallest relevant territory and returns a compact report.
6. If the Worker finds missing local information, it spawns another narrow Scout — it does not search broadly.
6a. **UNDER NO CIRCUMSTANCES does the Worker do any work while a Scout is running.** Dispatch → **stop** → receive → read only the files you will edit → edit. No side-quests while waiting.
7. One Worker = one coherent, tightly scoped job.
8. Do NOT spawn a post-Worker Scout verification pass. The Worker self-validates instead.
9. Self-validate: npx tsc --noEmit, npm run build, the two capped suite commands in §12.17.
10. Do not start future phases. Stop when this phase's acceptance criteria are met.

**Scout infrastructure — known defect.** Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start. If it fails, STOP and report a BLOCKER.

**Engine instability — known.** 262k context, ~390 MiB free, one slot, SIGKILLed under load. On-disk work survives; resume and continue. Checkpoint early and often.

Worker handoff format (mandatory)
```
COMPLETED:
FILES CHANGED:
TESTS:
VALIDATION:
DECISIONS:
BLOCKERS:
NEXT HANDOFF:
```

**§12.17 — the commands are mandatory, not the intention.** During development use `npx vitest run <path>` and `npx playwright test <spec>`. **Never `npm run test` as an iteration loop.** The full-suite gate is exactly these two commands, **once each, never concurrently**:

```
npx vitest run --pool=threads --poolOptions.threads.maxThreads=2
npx playwright test --workers=2
```

`npm run test` and `npm run test:e2e` use the default full-parallel pool and exhaust the user's machine. Slower is the point.

---

# Brief 69 — B-113: round the conversion product, and stop treating a self-contradicting document as an authority

**Defect: B-113. Decision already made — D-ROUND-2 in `docs/ai/USER_DECISIONS.md`, resting on `docs/ai/research/53_anaf_sector4_rounding_inconsistency.md`. Read both before you start. You are implementing a settled decision.**

---

## 1. The change

`src/domain/fx/convert.ts` deliberately does **not** apply `roundArt66` to the product of a currency conversion. **It now does.** A converted amount is rounded to whole lei by art. 66's own rule — fraction up to and including 50 bani neglected, fraction above 50 bani raised to the next leu — **at the point of conversion**, before the value is used downstream.

`roundArt66` already exists in `src/domain/money.ts` and is already applied roughly twenty times across income tax, CAS and CASS. **Do not write a second rounding function.**

---

## 2. Why, and what the justification is *not*

**It is:** ANAF converts and then publishes a **whole-leu** figure, and multiplies *that* figure downstream — `500 EUR × 4,977 = 2.488,50` is published as **2.488 lei lunar**, and `2.488 × 6 = 14.928` is the gross. The conversion product is rounded before use. And HG 1/2016 Norme metodologice, Titlul IV, Cap. I, Secț. 1, pct. 4 applies the art. 66 rule to **bazele de calcul**, which defeats the "only final sums owed" reading the code has been relying on.

**It is not** that ANAF's worked example demonstrates the rule. **It does not, and this is the part I need you to carry rather than smooth over.** That document contains **two chains** — payment-date 4,977 and BNR annual average 4,974 — and across them it produces three cases where art. 66 and a plain floor disagree:

| Step | Exact | ANAF printed | art. 66 | floor |
|---|---|---|---|---|
| Chain 1 forfetar | 2.985,**60** | 2.986 | **2.986** | 2.985 |
| Chain 2 net | 11.937,**60** | 11.938 | **11.938** | 11.937 |
| Chain 2 tax | 1.193,**80** | 1.193 | 1.194 | **1.193** |

**Two favour art. 66, one favours a floor. The document contradicts itself.** The conversion line itself separates in neither chain (`2.488,50` sits exactly on the inclusive-50 boundary; `2.487,00` has no fraction). **No primary text decides this.** The comment you write at the change site must say so — a reasoned choice, not a settled rule — and must keep the contrary arguments reachable: art. 310 alin. (1) and HG 1/2016 Titlul VII prescribe *different* rounding for the conversions they do regulate, and OUG 59/2005 art. 7 expressly declines to round intermediate conversion elements for local taxes.

---

## 3. The golden fixture — relabel, do not delete

`src/domain/golden/fxTruncation.test.ts` keeps the Sector 4 chain. Its header currently asserts *„ANAF applies art. 66 to each step"*, which research/53 refutes, and its three `it.fails` findings are written as though the published chain were a correct answer the engine misses.

**Reframe it as what it actually is: a FACT about what ANAF published, from a document that is internally inconsistent — not a specification.** Keep every published figure. Retitle the header and the findings so the next agent does not read them as an oracle. **Do not delete the fixture** — the inconsistency is itself evidence, and it is the reason this decision is a judgement rather than a lookup.

**Expect the `it.fails` to change status.** After your change, some of them may pass. **A finding that flips to passing must be renamed and re-labelled, not silently converted** — a green test whose name still says FINDING is how the next reader learns the wrong thing.

---

## 4. Money moves. Report every pin that moves.

This is the expensive part and it is why this brief runs **before** the CASS and expense work: up to 0,50 lei per converted amount, 3 lei across the six-month example, and every converted figure in the app.

**Before you re-pin anything, list every pinned figure that moves** — the 311.200-lei seed estimate at `src/data/seed.identityHygiene.test.ts:339`, persona heroes, deductible totals, euro-cap arithmetic, golden expectations — **with the old value, the new value, and why.** A re-pin without that list is the B-99/B-101/B-138 failure mode: a test updated to agree with the code rather than with the law.

**If a figure moves in a way you cannot explain from the arithmetic, stop and report it.** Do not chase it.

---

## 5. Boundaries

- **`src/domain/fx/**` and the golden suite are yours.** `roundArt66` itself is **not** to be modified — its inclusive-50 boundary is confirmed and pinned.
- **Do not touch the never-derive refusal** built in brief 68: the app must still refuse to compute an annual average from daily rates. That is pinned three ways in `src/domain/fx/annualAverageNeverDerived.test.ts`. **If your change interacts with it, report the interaction rather than resolving it.**
- **Do not change which rate is used** — D-FX-6 and the provisional/final lifecycle are settled and untouched here. This brief is about what happens to the *product*, not the *rate*.
- **No new legal claim.** Do not add a citation you have not read, and do not assert that art. 66 governs conversion — the record says it is undetermined.
- No changes to `caen_rev3.csv`, the CAEN ingest, or persona **figures** (a figure moving as a *consequence* of rounding is different from editing a persona; the latter stays out of scope).
- Do not touch B-140, B-136 (PARKED), or Step 12.

---

## 6. Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both capped full-suite commands → all pass, **once each**.
2. **A converted amount is a whole-leu value at the point of conversion**, and the value used downstream is that whole-leu value — not the unrounded product.
3. **A test on the ANAF conversion line itself:** `500 EUR × 4,977` yields **2.488 lei**, and `2.488 × 6` yields **14.928** — the published chain's first two steps, asserted as the engine's behaviour.
4. **A test pinning the boundary**, not just the example: a product ending `,50` is neglected and one ending `,51` is raised. The example alone cannot tell the two rules apart; the boundary can.
5. **The golden header and findings relabelled** as a known-inconsistent document, with every flipped `it.fails` renamed.
6. **The full list of moved pins**, old value → new value → reason.
7. **The never-derive refusal still passes unchanged**, and you say so explicitly.
8. Report **newly measured** unit and e2e counts.

---

## 7. One thing to watch for

Rounding at conversion can make a **sum of rounded parts differ from the rounded sum**. `2.488 × 6 = 14.928` but `2.488,50 × 6 = 14.931`. ANAF's published gross is **14.928**, which is the sum of rounded months — so **rounding per month and then summing is the behaviour the published example supports.** If the app currently sums unrounded amounts and rounds once at the end, that ordering difference is a real finding about *where* the rounding belongs, not just whether it belongs. **Report it rather than picking silently.**
