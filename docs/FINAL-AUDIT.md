# SOLO / Falcon — Local Replica · Final Audit

**Date:** 2026-09-28
**Scope:** Finalization + GitHub handoff of the local SOLO/Falcon accounting app replica.
**Status:** ✅ Ready for handoff

---

## 1. Overview

A faithful, fully client-side local replica of the SOLO / Falcon accounting web app
(Romanian e-Factura / tax workflow). Built with React + TypeScript + Vite. No backend,
no network calls — all state lives in the browser via `localStorage`.

## 2. Tech stack

| Layer      | Choice                          |
|------------|---------------------------------|
| Framework  | React 18                        |
| Language   | TypeScript 5.6                  |
| Build      | Vite 5.4 + `@vitejs/plugin-react` |
| Routing    | Custom hash-routing (`/page#!/tab`) on top of `history.pushState` |
| State      | React Context + `localStorage` persistence |
| Styling    | Single `styles.css` (design tokens + layout) |

Dependencies are minimal and standard: `react`, `react-dom`, `react-router-dom`
(declared; routing is implemented natively), plus dev tooling only.

## 3. Page / route map

| Route          | Page (RO)         | Hash tabs / categories                              |
|----------------|-------------------|-----------------------------------------------------|
| `/dashboard`   | Panou de control  | —                                                   |
| `/revenues`    | Venituri          | `inregistrata`, `in-asteptare`, `respinsa`          |
| `/expenses`    | Cheltuieli        | `inregistrata`, `respinsa`                          |
| `/efactura`    | e-Factura         | —                                                   |
| `/declarations`| Declarații        | — (pending badge in nav)                            |
| `/documents`   | Documente         | `Venituri`, `Cheltuieli`, `Raport`                  |
| `/clients`     | Clienți           | —                                                   |
| `/settings`    | Setări            | —                                                   |

**Hash aliases** (English → canonical) accepted in URLs:
- `revenues`: `registered`→`inregistrata`, `pending`→`in-asteptare`, `rejected`→`respinsa`
- `expenses`: `registered`→`inregistrata`, `rejected`→`respinsa`

Unknown pages fall back to `dashboard`; unknown tabs are dropped (page still renders).

## 4. Functional validation (verified in browser)

| Check                                        | Result |
|----------------------------------------------|--------|
| All 8 pages render                           | ✅     |
| Deep links (`/revenues#!/in-asteptare`, `/documents#!/Venituri`) | ✅ |
| Tab / category → URL sync                    | ✅     |
| English alias normalization (`#!/rejected` → `respinsa`) | ✅ |
| Back / forward (`popstate`)                  | ✅     |
| Initial URL normalization (`/` → `/dashboard`) | ✅    |
| `localStorage` persistence survives full reload | ✅  |
| Category filter actually filters rows (Venituri → 3 of 6) | ✅ |

## 5. Security audit

| Area                          | Finding |
|-------------------------------|---------|
| Secrets / API keys / tokens / passwords | **None** (only a CSS comment "design tokens") |
| Network calls (`fetch`/`axios`/XHR/WebSocket) | **None** — fully offline |
| Dangerous patterns (`eval`, `innerHTML`, `dangerouslySetInnerHTML`, `document.write`) | **None** |
| External URLs / original-site references in `src/` | **None** |
| `.env` files                  | **None** |
| Storage key                   | `solo-replica-data-v1` (non-sensitive) |
| Seed data PII                 | **Fictional only** — sequential fake CUIs (`RO12345678`), repeating fake phones, invented company names. No real personal data. |
| Dependencies                  | Standard React/Vite tooling; no suspicious packages |

**Result: clean.** No credentials, no exfiltration vectors, no real PII.

## 6. Data & persistence

- All collections (revenues, expenses, declarations, documents, clients, settings)
  persist to `localStorage` under `solo-replica-data-v1` and survive refresh.
- Seed data (`src/data/seed.ts`) is loaded on first run and is entirely fictional.
- No passwords are stored anywhere (per project rule: never write the password into the project).

## 7. Repo hygiene

- `.gitignore` excludes: `node_modules/`, `dist/`, `*.tsbuildinfo`, `.env*`, `.pi/`,
  and `docs/reference/` (the original site's IP — screenshots, extracted HTML/text,
  minified JS bundles — is input material, not part of the replica).
- Deliverable = the working replica in `src/` + this `docs/` audit.

## 8. Known limitations / next steps

- No real e-Factura / ANAF integration (by design — local replica only).
- No authentication (single hardcoded demo user "Popescu Ion").
- `react-router-dom` is declared but routing is hand-rolled; can be dropped if desired.

## 9. How to run

```bash
npm install
npm run dev      # dev server
npm run build    # production build → dist/
npm run preview  # serve the production build
```
