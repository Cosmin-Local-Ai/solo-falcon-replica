# PLAN — Expenses: faithful rebuild (Phase 2)

Rebuild `src/pages/Expenses.tsx` to match the live SOLO app, per the corrected research report
(`docs/reference/expenses.md`), the audit (`docs/audit-expenses.md`) and the QA report (`docs/QA-EXPENSES.md`).

Personal-use replica. All observed strings below are **exact** — do not paraphrase. Inferred behavior
is marked **[inferred]**.

---

## 1. Data model — `src/data/types.ts`

Replace the `Expense` interface and `EXP_STATUS_LABEL`:

```ts
export type ExpenseStatus = 'inregistrata' | 'in-procesare' | 'respinsa';
export type ExpenseCurrency = 'RON' | 'EUR' | 'USD' | 'GBP';

export interface Expense {
  id: string;
  supplier: string;           // Furnizor (known after successful processing)
  purchaseDate: string;       // ISO — Dată achiziție
  category: string;           // Categorie
  total: number;              // Total in document currency
  currency: ExpenseCurrency;  // RON default
  localTotal?: number;        // RON amount, shown when currency !== RON
  documentName: string;       // Nume document (file name)
  documentType: 'pdf' | 'jpg' | 'png';
  content?: string;           // Data URL for locally uploaded files
  status: ExpenseStatus;
  reason?: string;            // Motiv (respinsa)
  createdOn: string;          // ISO — Dată încărcare
  rejectedOn?: string;        // ISO — Dată procesare (respinsa)
  processingDeadline?: string; // ISO — Estimat procesare (in-procesare)
  simPending?: boolean;       // true = created by local upload, runs the processing sim
}

export const EXP_STATUS_LABEL: Record<ExpenseStatus, string> = {
  inregistrata: 'Înregistrată',
  'in-procesare': 'În procesare',
  respinsa: 'Respinsă',
};
```

- Add `fmtMoney(n: number, currency: ExpenseCurrency): string` — `Intl.NumberFormat('ro-RO', { style: 'currency', currency })`.
- Keep `fmtRON` (alias of `fmtMoney(n, 'RON')`), `fmtDate`, `total` (still used by Revenues).
- `EXPENSE_CATEGORIES: string[]` = local category list (the live app loads it from the server):
  ```
  'Auto/Moto', 'Bilete transport internațional', 'Cărți și materiale', 'Cheltuieli bancare',
  'Chirie', 'Comunicatii', 'Electronice/electrocasnice/software - achiziții', 'Furnizori servicii',
  'Hotele / cazare', 'Masa', 'Marketing', 'Salarii', 'Servicii și Abonamente',
  'Telefon / internet', 'Transport', 'Altele'
  ```

## 2. Seed data — `src/data/seed.ts`

Replace `seedExpenses` (new model). 8 items:

| id | status | supplier | purchaseDate | category | total/currency | documentName | other |
|----|--------|----------|--------------|----------|----------------|--------------|-------|
| e1 | inregistrata | SC ENERGIA DISTRIBUTIE SA | 2025-09-05 | Servicii și Abonamente | 381.13 RON | FCT-09-112043.pdf | createdOn 2025-09-05 |
| e2 | inregistrata | SC PETROM AFER TITAN SA | 2025-09-12 | Auto/Moto | 299.88 RON | BF-09-5521.pdf | createdOn 2025-09-12 |
| e3 | inregistrata | SC ORANGE ROMANIA SA | 2025-09-20 | Telefon / internet | 231.79 RON | FCT-09-8812.pdf | createdOn 2025-09-20 |
| e4 | inregistrata | DAF TRUCKS NL BV | 2025-08-14 | Bilete transport internațional | 1250.00 EUR, localTotal 6234.50 RON | invoice-DAF-2025-0814.pdf | createdOn 2025-08-14 |
| e5 | in-procesare | '' | '' | '' | 0 RON | bon-fiscal-carrefour.pdf | createdOn 2025-10-02, processingDeadline 2025-10-03 |
| e6 | in-procesare | '' | '' | '' | 0 RON | factura-orange-julie.pdf | createdOn 2025-09-28, processingDeadline 2025-09-29 (overdue → shows "În întârziere") |
| e7 | respinsa | '' | '' | '' | 0 RON | bon-fiscal-fara-cui.pdf | createdOn 2025-08-22, rejectedOn 2025-08-23, reason "Bon fiscal fără mențiunea CUI" |
| e8 | respinsa | '' | '' | '' | 0 RON | scan-nesleuit.pdf | createdOn 2025-08-14, rejectedOn 2025-08-15, reason "Scanare neclară — reîncarcă documentul" |

## 3. Store — `src/data/store.tsx`

- **Migration**: persisted data (key `solo-replica-data-v1`) may contain the OLD expense shape
  (`nr`, `tip`, `furnizor`, `valoareFaraTva`, `tva`). On load, map each old item:
  `supplier=furnizor, purchaseDate=date, category='Altele', total=valoareFaraTva+tva, currency='RON',
  documentName=nr, documentType='pdf', createdOn=date, status kept, reason=statusDetail`.
  Detect by presence of `valoareFaraTva`. Save the migrated data back.
- **Processing simulation** (local stand-in for the SOLO OCR backend): a `useEffect` with a 5s
  interval: any expense with `simPending === true` and `createdOn` older than 10s → set
  `status='respinsa'`, `rejectedOn=now`, `reason='Nu am putut extrage datele din document. Verifică fișierul și încarcă-l din nou.'`,
  `simPending=false`. (Marked `[local adaptation]` in a code comment.)
- Keep `addExpense`, `updateExpense`, `deleteExpense` as-is.

## 4. Router — `src/App.tsx`

- `VALID_TABS.expenses` → `['inregistrata', 'in-procesare', 'respinsa']`.
- Add alias normalization: `registered→inregistrata`, `rejected→respinsa`, `queued→in-procesare`
  (check how `pending` is handled for revenues and mirror the pattern).
- Update the comment block listing exact URL forms to include `/expenses#!/in-procesare`.
- Line 173: `initialTab` cast must accept the 3 keys.

## 5. Expenses page — `src/pages/Expenses.tsx` (full rewrite)

### Layout
- Header: `h1 "Cheltuieli"`, sub line `Cum deduc cheltuieli` (clickable ghost button → info panel),
  right action: primary button `Încarcă cheltuieli` (→ upload modal).
- Tabs (3, with counts): `Înregistrate` (key `inregistrata`) · `În procesare` (key `in-procesare`) ·
  `Respinse` (key `respinsa`).
- `tab` state synced to hash (existing pattern from Revenues).

### Tables (exact columns, per tab)
- **Înregistrate**: `Furnizor` | `Dată achiziție` | `Categorie` | `Total` (right-aligned;
  `fmtMoney(total, currency)`; when `currency !== RON` add a second muted line
  `≈ fmtMoney(localTotal, 'RON')`).
- **În procesare**: `Nume document` | `Dată încărcare` | `Estimat procesare` (when
  `now > processingDeadline` show `În întârziere` in danger color **[inferred]**).
- **Respinse**: `Nume document` | `Dată procesare` | `Motiv`. Above the table, a light-red banner:
  `Vezi mai multe detalii despre <a>motivele de revizuire</a> și ce trebuie să faci.` — link
  `https://help.solo.ro/hc/ro/articles/25439507769373-De-ce-s-a-respins-cheltuiala-și-ce-trebuie-să-faci` (target `_blank`).
- Rows: clickable (hover bg), open the slideout panel.
- Sort: `createdOn` desc. Infinite scroll: batch 20, `IntersectionObserver` on a sentinel div
  (no pagination buttons — the live app uses infinite scroll).

### Welcome screen (when `expenses.length === 0`)
Centered card: title `Încarcă cheltuieli`, text
`Încarcă cheltuieli pe care le poți deduce fiscal (facturi și bonuri de la furnizori) și le vei găsi aici, listate pe categorii.`,
primary button `Încarcă cheltuieli`.

### Slideout panel (new component `src/components/Slideout.tsx`)
Right-anchored panel (380px) with dimmed overlay, slide-in animation, close on overlay click / Esc.
Props: `title`, `onClose`, `footer?` (button array), `children`. Structure:
header (title + × close), scrollable body, footer bar.

Panel content per status (title = supplier for registered, documentName otherwise):
- **inregistrata**: cards `Dată achiziție`, `Categorie`, `Total` (+ `≈ … RON` line if foreign
  currency), `Document` card (file name + `Descarcă` button when `content` exists — anchor with
  `href=content download=documentName`). **No footer buttons** (observed).
- **in-procesare**: cards `Dată încărcare`, `Estimat procesare` (overdue variant `[inferred]`),
  `Document` card. Footer: `Șterge` (danger), `Închide` (ghost).
- **respinsa**: cards `Motiv` (danger-tinted), `Dată încărcare`, `Dată procesare`, `Document` card.
  Footer: `Reîncarcă` (primary), `Șterge` (danger), `Închide` (ghost).
- Card style: label (12px muted uppercase) + value (14px).
- `Șterge`: confirm via `window.confirm('Ștergi acest document?')` → `deleteExpense` → close panel,
  toast `Cheltuială ștearsă.`
- `Reîncarcă`: opens the upload modal in **single-file mode** for this expense; on save →
  `updateExpense` with new `content`/`documentName`/`documentType`, `status='in-procesare'`,
  `createdOn=now`, `processingDeadline=now+1d`, `simPending=true`, clear `reason`/`rejectedOn`.
- `Închide`: close panel.

### Upload modal (in-page, reuses `Modal` from ui.tsx)
- Title `Încarcă cheltuieli`.
- Dropzone: dashed-border area, text `Alege unul sau mai multe fișiere` (single-file mode:
  `Alege un fișier`), drag & drop + hidden `<input type=file multiple accept=".pdf,.jpg,.jpeg,.png">`.
  Highlight on dragover.
- Selected files listed (name + size). Max 2MB per file (reuse `MAX_DOC_BYTES` pattern from
  Documents) — reject bigger files with a toast.
- Footer: `Renunță` (ghost) / `Salvează` (primary, disabled until ≥1 file).
- On save (new): one expense per file → `status='in-procesare'`, `supplier=''`, `category=''`,
  `total=0`, `currency='RON'`, `documentName=file.name`, `content=dataURL`, `createdOn=now`,
  `processingDeadline=now+1d`, `simPending=true`. Switch tab to `in-procesare`. Toast
  `Documente încărcate.`
- Files read via `FileReader.readAsDataURL`.

### Info panel (in-page slideout, opened from "Cum deduc cheltuieli")
Title `Deducere cheltuieli`. Exact text:

> Cheltuielile tale sunt deduse automat în declarația ta lunară. Cea mai simplă modalitate de a
> deduce cheltuieli este prin încărcarea documentelor: facturi și bonuri fiscale de la furnizorii
> tăi.
>
> Documentele tale sunt procesate automat, iar datele extrase sunt adăugate în declarația ta lunară.
> Procesarea documentelor durează, de regulă, maximum o zi de lucru.
>
> Cheltuielile pe care le poți deduce: transport, cazare, masă, comunicații, salarii, chirie,
> materiale de birou, software și alte cheltuieli legate de activitatea ta.

Plus a link (target `_blank`): `https://www.solo.ro/cheltuieli-deductibile` — text
`Vezi lista completă de cheltuieli deductibile` **[inferred label]**.

## 6. Dashboard — `src/pages/Dashboard.tsx`

- `expTotal` → `expenses.reduce((s, e) => s + e.total, 0)` (was `total(e)`).
- `respins` count already uses `status === 'respinsa'` — no change.

## 7. Styles — `src/styles.css`

Add (match existing design tokens):
- `.slideout-overlay` (fixed, dimmed, z-40), `.slideout-panel` (fixed right, 380px, full height,
  white, shadow, `transition: transform .2s`, translateX slide-in), `.slideout-header`,
  `.slideout-body`, `.slideout-footer`.
- `.info-card` (label/value pair), `.info-card .label` (12px, muted, uppercase, letter-spacing),
  `.info-card .value` (14px).
- `.dropzone` (dashed border, centered, padding 24px), `.dropzone.active` (primary border/bg tint).
- `.expense-welcome` (centered card).
- `.banner-danger` (light red bg, red text, padding, radius).
- Reuse existing `.tabs`, `.table`, `.badge`, `.btn*`, `.page-header`.

## 8. QA checklist (verify before reporting done)

1. `npx tsc --noEmit` and `npm run build` pass.
2. Dev server: all 3 tabs render with the exact column headers above; counts match seeds (4/2/2).
3. Hash deep links: `/expenses#!/in-procesare`, `/expenses#!/queued`, `/expenses#!/registered` all work.
4. Row click → correct panel per status; `Descarcă` works on a locally uploaded file;
   `Șterge` asks confirm and removes; `Reîncarcă` re-uploads and moves item to În procesare;
   `Închide` closes.
5. Upload: pick 2 small .txt→no, pick 2 small .png/.pdf files → both appear in În procesare →
   after ~10s both auto-reject with the sim reason → appear in Respinse with Motiv.
6. Overdue item e6 shows `În întârziere`.
7. Empty state: clear localStorage expenses → welcome screen renders.
8. Info panel opens from `Cum deduc cheltuieli` with exact text.
9. Dashboard Cheltuieli total = sum of `total` (381.13+299.88+231.79+6234.50 = 7147.30 RON).
10. Old-shape localStorage data migrates (simulate by writing an old-shape expense to
    `solo-replica-data-v1` and reloading).

## Files touched
`src/data/types.ts`, `src/data/seed.ts`, `src/data/store.tsx`, `src/App.tsx`,
`src/pages/Expenses.tsx`, `src/pages/Dashboard.tsx`, `src/components/Slideout.tsx` (new),
`src/styles.css`.
