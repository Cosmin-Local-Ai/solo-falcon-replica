# 07 — Legislation System Specification

**Status:** Internal specification (conceptual, not an implementation)
**Scope:** Defines the internal architectural authority for the future legislation system of the SOLO Replica AI project.
**Audience:** Future implementation Workers. This document is the reference they must follow when implementing the legislation system.

---

## 1. Purpose & Scope

- This is a **conceptual internal specification** — it defines *what* the legislation system must be and *why*, not *how* to build it.
- It establishes the rules for how official Romanian tax/legislation sources are consumed, how legal changes are represented, how fiscal rules evolve, and how changes safely reach the tax engine.
- It is **not** an implementation: no crawler, no API client, no UI, and no application code is defined here.
- Future implementation Workers treat this document as the **internal architectural authority** for the legislation system. Any implementation that conflicts with it is non-compliant and must be reconciled back to this specification.

## 2. Official-Source Priority

All future legislation tooling must prefer official sources, in this exact order:

1. **Portal Legislativ**
2. **ANAF legislative/news archive**
3. **Official published acts**
4. **Ministry/Government official sources**

- This ordering is mandatory. A source at a lower priority level must not supersede one at a higher level for the same legal matter.
- **Unofficial sources must NOT be introduced as the primary legal authority** (e.g., blogs, aggregator sites, commercial tax newsletters). They may at most serve as lead-in signals that a change exists, never as the authority for the change itself.
- Rationale: legal changes drive tax computation. A wrong or secondary source can silently corrupt engine rules, so the chain of authority must start and stay with official publication.

## 3. Required Architecture (Conceptual Pipeline)

The legislation system is a pipeline. Stages must exist and must run in this exact order and meaning:

`OFFICIAL SOURCE` → `SOURCE ADAPTER` → `NORMALIZED LEGAL DOCUMENT` → `RELEVANCE FILTER` → `CHANGE DETECTOR` → `RULE MAPPING` → `VALIDATION` → `RULE RELEASE` → `TAX ENGINE IMPACT` → `USER NOTIFICATION`

- **OFFICIAL SOURCE** — the origin of a legal document, constrained by the priority order in Section 2.
- **SOURCE ADAPTER** — converts a document as published by a specific official source into a common internal form. One adapter per source; the rest of the pipeline is source-agnostic.
- **NORMALIZED LEGAL DOCUMENT** — a source-independent representation of the legal act (identity, text, dates, status), suitable for downstream processing.
- **RELEVANCE FILTER** — discards documents that do not affect the project's tax domain (e.g., acts unrelated to the taxes the engine computes).
- **CHANGE DETECTOR** — compares a normalized document against the currently known legal state and identifies what has changed (new, amended, repealed).
- **RULE MAPPING** — translates detected legal changes into candidate modifications of fiscal rules.
- **VALIDATION** — subject-candidate changes to automated checks (consistency, test suites, invariants) before anything is allowed to activate.
- **RULE RELEASE** — the controlled publication step that moves validated rule changes into a releasable state, per the lifecycle in Section 5.
- **TAX ENGINE IMPACT** — the point at which released rules actually change tax computation.
- **USER NOTIFICATION** — informs users that computation behavior has changed and why, referencing the underlying legal change.

No stage may be skipped, and no stage may be reordered. In particular, nothing from `CHANGE DETECTOR` onward may reach the tax engine without passing through `VALIDATION` and `RULE RELEASE`.

## 4. Legal-Change Distinctions

Every legal change must be recorded with these fields kept **distinct**. They must NOT be collapsed into a single date or a single state:

- **`publishedDate`** — when the act was officially published.
- **`effectiveFrom`** — when the act's provisions start to apply.
- **`taxYear`** — the fiscal year the change governs.
- **`status`** — the current legal standing of the change (e.g., in force, amended, repealed).

Rationale: publication, applicability, and fiscal-year scope are legally independent facts. A single date cannot express, for example, an act published in December that takes effect in January and governs the following tax year. Collapsing them produces silent, undetectable miscomputation.

## 5. Rule Lifecycle

A fiscal rule moves through the following states, in order:

`PROPOSED` → `VALIDATED` → `STAGED` → `SCHEDULED` → `ACTIVE` → `SUPERSEDED`

- **PROPOSED** — a rule change has been drafted from a legal change; it is not trusted yet.
- **VALIDATED** — the change passed automated validation (Section 6 flow).
- **STAGED** — the change is prepared for activation and ready to be scheduled.
- **SCHEDULED** — the change is committed to activate at a defined point (e.g., tied to `effectiveFrom` / `taxYear`).
- **ACTIVE** — the rule is in force and influences tax computation.
- **SUPERSEDED** — the rule has been replaced by a later rule; it is retained for history and audit, never silently deleted.

- Transitions must follow this order; a rule may not jump directly from PROPOSED to ACTIVE.
- Supersession is the only terminal state — rules are replaced, not erased, so the audit trail of why a computation was made at a given time is always reconstructable.

## 6. Safety Rule (Candidate-Change Flow)

**Central architectural rule:** it is **NEVER** acceptable to implement `new official document → immediately overwrite active tax rules`.

Instead, every incoming document must follow this conceptual flow:

`document` → `candidate change` → `affected rules` → `automated tests` → `safe activation OR review required`

- **document** — the normalized legal document enters the pipeline.
- **candidate change** — the detected change is recorded as a *candidate*; it has no effect on computation at this point.
- **affected rules** — the set of fiscal rules that the candidate change would modify is explicitly identified.
- **automated tests** — the candidate is exercised against automated tests before activation.
- **safe activation OR review required** — the outcome is binary: the change activates only if it passes, otherwise it is parked for human review. There is no silent middle path.

Rationale: a document being published is not evidence that a rule change is correct, complete, or in force. Automatic overwrite would let a misread, a partial act, or a parsing error corrupt live tax computation with no opportunity for detection. The candidate-change flow makes every rule change explicit, testable, and reversible.

## 7. Conceptual Models

These are **specifications of concepts**, not application implementations. They define what each entity must capture; concrete data structures are a decision for future implementation Workers.

### LegalChange

**Purpose:** the canonical record of a change in the legal state, produced by the pipeline from an official source. It is the unit of truth that rule changes reference.

Important fields/concepts:

- Identity of the underlying act (issuer, act reference, source provenance).
- `publishedDate`, `effectiveFrom`, `taxYear`, `status` — kept distinct per Section 4.
- The nature of the change (new, amendment, repeal).
- Provenance link back to the official source document (so any rule derived from it is traceable to its legal origin).

### FiscalRule

**Purpose:** a single, testable unit of tax computation logic that the tax engine applies. It is the unit that changes when the legal state changes.

Important fields/concepts:

- The rule's domain: which tax, which situation, which parameters it governs.
- Lifecycle state per Section 5 (PROPOSED … SUPERSEDED).
- Scope of applicability: the `taxYear` / effective period during which the rule applies.
- Derivation reference: the `LegalChange` (and ultimately the official document) the rule was derived from.
- Test association: the automated tests that must pass before the rule may activate (Section 6).

### RuleRelease

**Purpose:** the controlled event that moves a set of validated rule changes from preparation into activation (or into review). It is the gate between the pipeline and the tax engine.

Important fields/concepts:

- The set of rule changes included in the release.
- The release outcome: **safe activation** or **review required** (per Section 6).
- Scheduling information: when activation is committed to take effect, aligned with `effectiveFrom` / `taxYear`.
- Reference to the validating evidence (which automated tests ran and passed).
- Audit identity: a durable record that this release happened, so the tax engine's state at any time is explainable.

## 8. Non-Goals / Exclusions

This specification deliberately excludes:

- Any crawler, scraper, or automated fetching implementation.
- Any API client, SDK, or transport-layer design.
- Any user interface or notification-channel design (only the *concept* of user notification is defined).
- Any application code, data schemas, database design, or framework/library choices.
- Any legal advice: the system records and applies official legal changes; it does not interpret law beyond what is required to map a change onto a rule.

If a future Worker needs any of the above, it must be decided in a later, implementation-scoped decision document — not here.

## 9. Authority & Handoff

- This document is the **internal architectural authority** for the legislation system of the SOLO Replica AI project.
- Future implementation Workers:
  - Must implement the pipeline order (Section 3), the source priority (Section 2), the legal-change distinctions (Section 4), the rule lifecycle (Section 5), and the candidate-change safety flow (Section 6) **exactly as specified**.
  - May choose concrete technologies, schemas, and code structure freely, provided they do not contradict this specification.
  - Must not weaken the safety rule (Section 6) under any circumstances; it is a hard constraint, not a guideline.
- Any proposed deviation from this specification requires a new decision document that explicitly references and supersedes the relevant section.
