# Step 07 — Legislation System Specification

# Role
Specification worker (Task 7).

# Objective
Establish the internal conceptual specification for the legislation system
(source ingestion → validated rule releases) as the architectural authority
for future implementation workers — no implementation.

# Work performed
- Authored docs/ai/decisions/07_LEGISLATION_SPEC.md, the first decision doc,
  establishing the decision-doc convention (numbered H1 + H2, bullets, short
  prose).
- Defined the required architecture, rule lifecycle, and conceptual models.
- Verified the document structure (H1 + 9 H2 sections in order, 3 H3 model
  subsections).

# Files inspected
- docs/ai/steps/08_stack_setup.md (step-doc style reference).
- docs/ai/decisions/ (empty before this task).

# Files changed
- docs/ai/decisions/07_LEGISLATION_SPEC.md (new).
- docs/ai/steps/07_legislation_spec.md (this file).
- STATE.md will be updated separately.

# Findings
The spec fixes the system's required shape:
- Architecture — 10-stage pipeline, in order, no skipping/reordering:
  OFFICIAL SOURCE → SOURCE ADAPTER → NORMALIZED LEGAL DOCUMENT →
  RELEVANCE FILTER → CHANGE DETECTOR → RULE MAPPING → VALIDATION →
  RULE RELEASE → TAX ENGINE IMPACT → USER NOTIFICATION.
- Lifecycle — 6 states, no jumps, supersession terminal (audit trail kept):
  PROPOSED → VALIDATED → STAGED → SCHEDULED → ACTIVE → SUPERSEDED.
- Conceptual models — LegalChange, FiscalRule, RuleRelease (purpose + key
  fields; specs, not app implementations).
- Safety rule — never "new document → immediately overwrite active rules";
  required flow: document → candidate change → affected rules → automated
  tests → safe activation OR review required.
- Source priority — Portal Legislativ → ANAF archive → official published
  acts → Ministry/Government; unofficial sources barred as primary authority.

# Decisions
- Kept the spec fully conceptual: no code, no schemas, no framework choices.
- docs/ai/decisions/07_LEGISLATION_SPEC.md is the internal architectural
  authority; deviations require a superseding decision doc.
- Deliberately NOT added: crawler, API client, legislation-monitor UI,
  application source-code changes, implementation of the legislation system,
  new legislation research, internet browsing.

# Tests
- Structure check: file exists (149 lines), H1 + 9 H2 sections in required
  order, 3 H3 model subsections.

# Problems
- None.

# Handoff
- Verification: docs/ai/decisions/07_LEGISLATION_SPEC.md exists and passed
  the structure check.
- Next: implementation of the legislation system is a FUTURE task; do not
  begin Task 8 now. Future implementation workers use the decision doc as
  the internal architectural authority.
