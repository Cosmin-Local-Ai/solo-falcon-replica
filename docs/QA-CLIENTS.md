# QA Report — Clienți Page (Priority 5)

**Date:** 2025-07-19
**Scope:** `src/pages/Clients.tsx`, `src/data/store.tsx`, `src/data/types.ts`
**Method:** Live browser testing against `http://localhost:5173/clients` (Vite dev server), with reference baseline from `docs/reference/settings.md`, `docs/FINAL-AUDIT.md`, and live-app reconnaissance.

## Reference Baseline (real app)

- 4 seed clients: IONEL POPESCU (PFA), SC LOGICOM SRL, SC VETRA SRL, ANA MARIN (PFA)
- Table columns: Denumire / CUI / Email / Telefon / Oraș / Tip + Acțiuni
- Per-row context menu (⋮) with **delete confirmation modal**
- CUI input with **ANAF search** button (looks up company data by CUI)
- CUI validation: `^[0-9]{9,12}$`
- Name required, CUI unique across clients
- Persistence via localStorage

## Test Results

| # | Test | Result |
|---|------|--------|
| T1 | Initial render (4 seed rows, correct columns) | ✅ PASS |
| T2 | CUI format validation (1234 → "CUI trebuie să conțină 9–12 cifre.") | ✅ PASS |
| T3 | Duplicate CUI validation ("CUI-ul 12345678 este deja folosit de alt client.") | ✅ PASS |
| T4 | Add client (TEST CLIENT SRL created, row appears) | ✅ PASS |
| T5 | Persistence — client survives page reload | ✅ PASS |
| T6 | Delete client (✕ button → confirm → row removed) | ✅ PASS |
| T7 | Delete persistence — deletion survives reload | ✅ PASS |

## Bug Found & Fixed

**Missing delete button.** The store exposed `deleteClient`, but the Clients page never rendered a delete control (last column was an empty `<td />`).

**Fix:** Added a ✕ button in the last column of each row, with a `window.confirm()` guard:

```tsx
<td>
  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(client)} title="Șterge">✕</button>
</td>
```

Type-check passes (`npx tsc --noEmit`).

## Fidelity Gaps vs. Real App (not fixed — flagged)

1. **Delete UX:** Real app uses a per-row context menu (⋮) + styled confirmation modal. Replica uses a direct ✕ button + `window.confirm()`. Functionally equivalent, visually different.
2. **ANAF search missing:** Real app has a CUI input + ANAF lookup button that fetches company data. Replica has no ANAF integration (no references to ANAF anywhere in the page/store/types).
3. **Acțiuni column header:** Real app labels the last column "Acțiuni"; replica's header row omits it.

## Test-Harness Note

Mid-test, the browser session restarted with a fresh profile (new `user-data-dir`), which wiped localStorage and made a test client appear "lost". This is a **harness artifact, not an app bug** — persistence was independently verified in T5/T7 within a stable session.

## Final State

App left in clean state: localStorage cleared, original 4 seed clients restored.
