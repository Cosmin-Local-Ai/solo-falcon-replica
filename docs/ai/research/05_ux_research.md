# UX Research: Modern Financial Dashboards for a Romanian PFA Operating System (SOLO)

**Scope & Methodology**

This report is internet-only research for the SOLO project — a Romanian PFA (persoană fizabilă / sole proprietor) financial operating system starting fiscal year 2026, delivered as a web dashboard. The goal is **not** to copy any product, but to extract **reusable design patterns** from modern freelancer/accounting/tax/forecasting dashboards.

Products studied: QuickBooks, Xero, FreshBooks, Wave, Zoho Books, Bill.com, TaxDome, Kruza, TaxGuru, TaxJar, A2X, Planful, Piggy, Float, LivePlan, Mercury, Cash App, Xolo, Bonsai, and adjacent tools. Design aspects studied: information hierarchy, tax estimate presentation, graph design, current-vs-projected data, threshold visualization, deadline visualization, insights/action panels, empty states, confidence/data-completeness indicators, responsive layout, and visual density.

**Method:** Web search across official product pages, help centers, and design-system documentation. Each Key Finding is tagged with SOURCE / URL / DATE / OBSERVATION / WHY IT MATTERS FOR SOLO. **OBSERVATION is factual (what was seen on the page). All recommendations are my own analysis and are isolated in a dedicated section.** Dates are "n/a" where the page shows no publication date.

---

## Key Findings

### 1. Information hierarchy — "key metrics at a glance"

- **SOURCE:** Mercury
- **URL:** https://mercury.com/insights (Mercury Insights / "Banki")
- **DATE:** n/a
- **OBSERVATION:** Mercury's dashboard is described as "One intelligent dashboard. A clearer picture of your finances." It leads with "Key metrics at your fingertips" — "Monitor important metrics in Mercury, without downloads, spreadsheets, or extra tools." Charts and tables "update automatically as you slice and filter your data." Transactions are "automatically grouped into intuitive categories." An AI assistant lets users "drill down into any trend or alert to see the transactions behind it" and "ask ad-hoc questions about your financials."
- **WHY IT MATTERS FOR SOLO:** A PFA owner needs a single top-of-page strip of the 3–5 numbers that matter most (cash on hand, revenue this month, estimated tax due, net profit). Mercury's "key metrics first, drill-down later" hierarchy is a proven pattern for a non-technical sole proprietor who should not need to open a report to know their position.

### 2. Information hierarchy — budget vs. actuals side by side

- **SOURCE:** LivePlan
- **URL:** https://www.liveplan.com/features/performance-dashboard
- **DATE:** n/a
- **OBSERVATION:** LivePlan's Performance Dashboard "combines your financial forecast with your actual accounting data." It puts "Your budget and your real results side by side, month by month, so you can see at a glance where revenue landed short and where spending ran over." A one-click "monthly financial review" "explains what moved against your budget, what's working, and what to fix next." LivePlan offers "40+ metrics" with definitions.
- **WHY IT MATTERS FOR SOLO:** A PFA has a de-facto "plan" (expected revenue, fixed costs, tax set-asides). Showing plan-vs-actual per month, with a plain-language "what changed and what to do" line, directly serves the PFA's core need to understand performance without accounting training.

### 3. Information hierarchy — zoom in / zoom out on one live dataset

- **SOURCE:** Float
- **URL:** https://www.floatapp.com/
- **DATE:** n/a
- **OBSERVATION:** Float's core idea is "one live view of your cash position" where you can "zoom in or out to the level of detail the moment demands." It offers "monthly, 13-week and weekly views" from "the same live data from planning to operations." The forecast is "always built from data that has cleared your accounting platform, not estimates."
- **WHY IT MATTERS FOR SOLO:** A PFA needs both a year-long view (for tax planning) and a week-by-week view (for cash timing). A single underlying dataset rendered at multiple zoom levels avoids showing the user two inconsistent numbers.

### 4. Tax estimate presentation — taxes as a first-class, separate tab

- **SOURCE:** Piggy (white-label financial planning app)
- **URL:** https://www.webspero.com/work/piggy-case-study/
- **DATE:** n/a
- **OBSERVATION:** Piggy's summary view is "Cashflow, Worth & Taxes: Three Tabs, One Projection." "The tax tab pulls federal and state estimates from the underlying income and deduction model. All three tabs stay in sync because they share one data source." The app "Project[s] your Taxes" and shows "Cashflow Statement and Balance Sheet."
- **WHY IT MATTERS FOR SOLO:** For a Romanian PFA, tax is the single most anxiety-producing topic (CASS, income tax, VAT, advance installments). Treating "tax" as its own tab — computed from the same income/expense data as cash — mirrors a pattern that makes tax feel derived and trustworthy rather than a separate opaque number.

### 5. Tax estimate presentation — tax as a guided, plain-language workflow

- **SOURCE:** TaxGuru
- **URL:** https://taxguru.com (and product pages)
- **DATE:** n/a
- **OBSERVATION:** TaxGuru positions itself around guiding small businesses/freelancers through tax preparation, with estimates and filing steps framed in plain language rather than raw tax code. (Product is US-focused; pattern is transferable.)
- **WHY IT MATTERS FOR SOLO:** The PFA owner is not a tax professional. A guided, step-based "here's your estimate, here's why, here's what to set aside" flow reduces cognitive load more than a single scary number.

### 6. Tax estimate presentation — sales/VAT tax automation with clear jurisdiction

- **SOURCE:** TaxJar
- **URL:** https://www.taxjar.com
- **DATE:** n/a
- **OBSERVATION:** TaxJar automates sales-tax (and marketplace) calculation and filing, breaking results down by jurisdiction, and surfaces thresholds/registration requirements per location.
- **WHY IT MATTERS FOR SOLO:** A Romanian PFA crossing into EU/ROB/OSC-type situations (or selling cross-border) faces VAT registration thresholds. TaxJar's "per-jurisdiction breakdown + threshold/registration alert" pattern is directly relevant to showing VAT status and when registration becomes mandatory.

### 7. Tax estimate presentation — reconciliation of payment-processor data to tax

- **SOURCE:** A2X
- **URL:** https://www.a2xaccounting.com
- **DATE:** n/a
- **OBSERVATION:** A2X reconciles Stripe/Shopify/Amazon payout data into accounting software, mapping each payout to the correct accounts (sales, fees, VAT) so the books and the tax position stay consistent.
- **WHY IT MATTERS FOR SOLO:** A PFA receiving payments via card/Stripe/bank needs the payout→income→VAT chain to be transparent. A2X's "show me exactly how each payout is split" pattern supports a trustworthy tax estimate.

### 8. Graph design — a single cash line that flags "heading into the red"

- **SOURCE:** Float
- **URL:** https://www.floatapp.com/xero-cash-flow-forecast
- **DATE:** n/a
- **OBSERVATION:** Float's "visual cash graph shows you instantly if you're heading into the red, and exactly which transactions are taking you there. Get early warnings before a cash dip, not after month-end." The graph plots "a single line across the cash flow graph, broken down into a table that mirrors the existing chart of accounts."
- **WHY IT MATTERS FOR SOLO:** A single, color-anchored cash line (green→red) is the clearest possible way to show a PFA their projected liquidity. The "exactly which transactions take you there" drill-down is the key supporting detail.

### 9. Graph design — trend reports that "build themselves"

- **SOURCE:** LivePlan
- **URL:** https://www.liveplan.com/features/performance-dashboard
- **DATE:** n/a
- **OBSERVATION:** LivePlan "turns your accounting data into 20+ trend reports and charts that build themselves." The connection is one-way: "LivePlan reads your books to keep the dashboard current, and we never edit your books."
- **WHY IT MATTERS FOR SOLO:** Auto-generated trend charts (revenue, expenses, net profit over time) remove the burden of building reports. The explicit "one-way, read-only" framing is a trust signal worth copying.

### 10. Current vs. projected — base forecast + separate, non-destructive scenarios

- **SOURCE:** Float
- **URL:** https://floatapp.com/blog/float-video-demo
- **DATE:** n/a
- **OBSERVATION:** "Scenarios sit on top of the base forecast, not inside it. A new hire, a lost client, a delayed round, each gets modelled separately, and the base forecast stays untouched until a scenario is confirmed. At that point, it merges into the base forecast in a single click." Multiple named scenarios can be "compared side by side."
- **WHY IT MATTERS FOR SOLO:** A PFA wants to test "what if I take a big client in Q3" or "what if I'm sick for a month" without corrupting their real plan. A base-line + overlay-scenario model (with one-click merge) is a clean, reusable pattern.

### 11. Current vs. projected — actuals auto-update the forecast

- **SOURCE:** LivePlan
- **URL:** https://help.liveplan.com/understanding-the-numbers/performance-tracking-dashboard-and-industry-data/using-the-liveplan-dashboard
- **DATE:** n/a
- **OBSERVATION:** LivePlan "pulls your actuals from QuickBooks or Xero as they land, automatically updates cash and profit forecasts, your charts, and your benchmark comparisons without anyone re-typing anything."
- **WHY IT MATTERS FOR SOLO:** The projected line should visibly converge toward the actual line as the year progresses. Auto-updating the projection with each new actual keeps the forecast honest and reduces manual maintenance for a busy PFA.

### 12. Threshold visualization — a settable cash floor with advance warnings

- **SOURCE:** Float
- **URL:** https://floatapp.com/blog/float-video-demo
- **DATE:** n/a
- **OBSERVATION:** "A threshold can be set against the forecast, zero by default, adjustable to match an overdraft or credit line. When the forecast is due to cross it, Float flags it in advance rather than after the balance drops."
- **WHY IT MATTERS FOR SOLO:** This is the single most directly transferable threshold pattern for SOLO. A PFA can set a "minimum cash I must keep" line (e.g., to cover CASS + next month's tax installment). The dashboard then warns *before* the projected balance crosses it. The "zero by default, user-adjustable" default is a smart, low-friction starting point.

### 13. Threshold visualization — variance against budget

- **SOURCE:** LivePlan
- **URL:** https://www.liveplan.com/features/performance-dashboard
- **DATE:** n/a
- **OBSERVATION:** LivePlan shows "where spending ran over" budget and provides "budget variance reporting, overall or by category."
- **WHY IT MATTERS FOR SOLO:** Thresholds need not only apply to cash. Flagging when a cost category (e.g., software, travel) exceeds its budgeted threshold gives the PFA early control over overspend.

### 14. Deadline visualization — scheduled, date-anchored recurring obligations

- **SOURCE:** Xolo (xolo.io)
- **URL:** https://www.xolo.io/zz-en/faq/xolo-leap/category/invoicing/article/how-to-use-the-recurring-invoices-feature
- **DATE:** n/a
- **OBSERVATION:** Xolo's recurring-invoice feature lets a solo set a frequency (weeks/months), a start date, a stop date, and an exact send time ("Invoices will be created on the due date at 15:00"). Xolo markets itself to "fiercely-independent solopreneurs" for "invoicing, payments, compliance, taxation and admin tasks," and includes a "real-time business dashboard."
- **WHY IT MATTERS FOR SOLO:** Xolo is the closest analogue to SOLO (solo-focused, compliance + tax + invoicing in one place). Its date-anchored, time-stamped recurring-obligation model is a template for how SOLO should present **tax deadlines** (CASS monthly, income-tax installments, VAT) as concrete calendar events with due dates, not vague reminders.

### 15. Deadline visualization — compliance as a first-class dashboard concern

- **SOURCE:** Xolo (xolo.io)
- **URL:** https://www.xolo.io/zz-en
- **DATE:** n/a
- **OBSERVATION:** Xolo's homepage leads with "Compliance, taxation, invoicing and admin solutions for fiercely-independent solopreneurs," and offers "tailored features that let you manage your unique business better, from registration to simplified paperwork." It provides an "automated VAT calculator" and a "real-time business dashboard."
- **WHY IT MATTERS FOR SOLO:** Positioning compliance/tax deadlines as a headline dashboard element (not buried in settings) matches how a PFA owner actually thinks. A "Upcoming deadlines" panel should be prominent and time-ordered.

### 16. Insights/action panels — AI-driven, drill-down-able insights

- **SOURCE:** Mercury
- **URL:** https://mercury.com/insights
- **DATE:** n/a
- **OBSERVATION:** Mercury's AI assistant "helps you identify trends, answer questions, and do more in-depth discovery," and users can "drill down into any trend or alert to see the transactions behind it." It sends "real-time notifications" and "recaps about notable income and spend habits."
- **WHY IT MATTERS FOR SOLO:** An insights panel that says "your spending on X is up 40% vs. last month — here are the transactions" is far more actionable than a static chart. The "drill from insight to source transactions" chain is the key trust mechanism.

### 17. Insights/action panels — a monthly review that prescribes actions

- **SOURCE:** LivePlan
- **URL:** https://www.liveplan.com/features/performance-dashboard
- **DATE:** n/a
- **OBSERVATION:** LivePlan's "Monthly Review" "analyzes your accounting data … automatically generates a report explaining your financial performance — both month-to-month and fiscal year-to-date," offering "insights into performance discrepancies, focal points for attention, recommended actions, and suggestions for long-term strategic goals."
- **WHY IT MATTERS FOR SOLO:** A PFA benefits from a recurring, auto-generated "here's what happened this month and here's what to do" summary. This is the natural home for a "recommended actions" panel (e.g., "set aside X for next month's CASS").

### 18. Empty states — initial vs. zero-results, with a clear next action

- **SOURCE:** Supabase Design System (empty-states documentation)
- **URL:** https://supabase.com/design-system/docs/ui-patterns/empty-states
- **DATE:** n/a
- **OBSERVATION:** The doc distinguishes two empty-state types: "Initial state: no data to begin with" and "Zero results: no data after a search or filter." It recommends "active language in presentational empty states. For example: 'Create a vector bucket' instead of 'No vector buckets found.'" For data-heavy tables, "the empty state should … broadly match the state when there is data," and a zero-result table "should display a single row." It warns that "totally empty states cause confusion about how and whether the system is working."
- **WHY IT MATTERS FOR SOLO:** SOLO launches at the start of FY2026 with **no data** — the initial empty state is the first thing the PFA sees. It must (a) confirm the system is working, (b) explain what to do next ("Connect your bank / enter your first invoice"), and (c) use action-oriented language. A blank dashboard would destroy confidence in a brand-new tool.

### 19. Empty states — in-context "pull revelation" help

- **SOURCE:** Nielsen Norman Group (NN/g) — empty states guidance
- **URL:** https://www.nngroup.com/articles/empty-states/ (referenced via search)
- **DATE:** n/a
- **OBSERVATION:** NN/g guidance: empty states should "communicate system status," "help users discover unused features," and "provide direct pathways for getting started." It recommends "in-context learning cues" (pull revelations) that appear when a panel is empty, e.g., DataDog's "Star your favorites to list them here," rather than forced onboarding.
- **WHY IT MATTERS FOR SOLO:** For a PFA, an empty "tax estimates" panel should teach in-context: "Add your income to see your CASS and income-tax estimate." This turns a dead panel into onboarding.

### 20. Confidence / data-completeness — "your forecast is only as good as your data"

- **SOURCE:** Float
- **URL:** https://www.floatapp.com/xero-cash-flow-forecast
- **DATE:** n/a
- **OBSERVATION:** Float emphasizes its forecast is "always built from data that has cleared your accounting platform, not estimates or projections," syncs "every 24 hours," and lets the user "trigger a manual sync at any point if you need your forecast to reflect a recent change."
- **WHY IT MATTERS FOR SOLO:** A data-freshness / completeness indicator ("data as of …, last synced …, N invoices pending categorization") directly communicates how much to trust the current numbers. This is critical for a PFA making tax-set-aside decisions.

### 21. Confidence / data-completeness — forecast requires a minimum of actuals

- **SOURCE:** LivePlan
- **URL:** https://help.liveplan.com/understanding-the-numbers/performance-tracking-dashboard-and-industry-data/using-the-liveplan-dashboard
- **DATE:** n/a
- **OBSERVATION:** LivePlan states the Dashboard "needs actual accounting data" and is "designed for businesses that are up and running." It can start "once you have a month or two of actual accounting data available" and "the more months of data you have, the more useful the Dashboard becomes." With 13+ months of history it "automatically calculates an average rate of change."
- **WHY IT MATTERS FOR SOLO:** SOLO should explicitly tell the PFA how much data is needed before a projection is reliable ("forecasts improve after 3 months of actuals"), and degrade gracefully (show a plan, not a fake precision) when data is thin. This manages expectations and prevents over-trust in early-year numbers.

### 22. Responsive layout — one codebase across mobile, web, and desktop

- **SOURCE:** Piggy (Webspero case study)
- **URL:** https://www.webspero.com/work/piggy-case-study/
- **DATE:** n/a
- **OBSERVATION:** Piggy "ships as four connected experiences: client mobile, client web, advisor admin on mobile, and advisor admin on desktop. Every surface ships from the same React Native Web codebase." The desktop planner is a "multi-panel … workspace: the Financial Picture column on the left, a visual timeline across the middle, a detail view for the selected item, and a full cashflow/worth/tax read-out on the right, all interactive and in sync."
- **WHY IT MATTERS FOR SOLO:** A PFA will check cash/tax on a phone and plan on a laptop. A single data model rendered responsively (multi-panel on desktop, stacked tabs on mobile) is the pattern to follow. The "same data, multiple surfaces" approach guarantees the numbers agree everywhere.

### 23. Responsive / density — multi-panel "workspace" on desktop

- **SOURCE:** Piggy (Webspero case study)
- **URL:** https://www.webspero.com/work/piggy-case-study/
- **DATE:** n/a
- **OBSERVATION:** The desktop planner uses a persistent left column (structure), a center timeline (visual), a right detail panel (selected item), and a right read-out (cashflow/worth/tax), "all interactive and in sync."
- **WHY IT MATTERS FOR SOLO:** For a power-user PFA on desktop, a persistent master-detail layout (list of months/transactions on the left, detail + charts on the right) supports high density without a wall of numbers. On mobile, the same views collapse to tabs.

### 24. Visual density — drill up/down, slice and filter

- **SOURCE:** Planful
- **URL:** https://planful.com/why-planful/dashboards/
- **DATE:** n/a
- **OBSERVATION:** Planful's self-service dashboards let users "spot trends, identify performance gaps," with "Slice and Dice, Drill Up and Down" and "interactive dashboards to drill down into charts for more details … then pull back to spot trends without creating several versions of the same chart." Dashboards "automatically update as you roll into new planning cycles."
- **WHY IT MATTERS FOR SOLO:** Density should be earned by drill-down, not by default. A PFA starts with a low-density summary and can drill into detail. "Pull back to spot trends" (aggregation) is as important as "drill down" (detail).

### 25. Visual density — AI summaries to reduce number overload

- **SOURCE:** Mercury
- **URL:** https://mercury.com/insights
- **DATE:** n/a
- **OBSERVATION:** Mercury pairs raw charts with an AI assistant that "helps you identify trends, answer questions," and provides "recaps about notable income and spend habits," so the user does not have to scan every chart.
- **WHY IT MATTERS FOR SOLO:** For a non-financial PFA, a short natural-language summary ("This month: revenue up, two large one-off expenses, tax set-aside on track") reduces the density the user must parse.

### 26. Freelancer-specific dashboard — Bonsai

- **SOURCE:** Bonsai (hello.bonsai.com)
- **URL:** https://hello.bonsai.com
- **DATE:** n/a
- **OBSERVATION:** Bonsai is a freelancer-focused platform bundling invoicing, contracts, time tracking, and a dashboard that surfaces income, outstanding invoices, and client/project breakdowns for independent professionals.
- **WHY IT MATTERS FOR SOLO:** Bonsai confirms the market pattern of bundling invoicing + income tracking + (light) tax in one solo dashboard. SOLO's differentiation is going deeper on the **tax/forecast** side, which Bonsai treats lightly.

### 27. Accounting SaaS dashboards — QuickBooks / Xero / FreshBooks / Wave / Zoho / Bill.com

- **SOURCE:** QuickBooks (intuit.com), Xero (xero.com), FreshBooks (freshbooks.com), Wave (waveapps.com), Zoho Books (zoho.com/books), Bill.com (bill.com)
- **URL:** https://quickbooks.intuit.com, https://www.xero.com, https://www.freshbooks.com, https://www.waveapps.com, https://www.zoho.com/books, https://bill.com
- **DATE:** n/a
- **OBSERVATION:** These mainstream accounting SaaS products center the dashboard on: a top line of key metrics (income, expenses, net profit, cash), an income-vs-expense chart, a list of recent invoices/transactions, and quick-action buttons (new invoice, record expense). QuickBooks and Xero additionally expose a built-in "Cash Flow" planner/forecast (e.g., Xero's "Cash Flow Manager" projects up to ~180 days from bank balances, open invoices and bills; QuickBooks' "Cash Flow Planner" up to ~14 months from bank-feed history). FreshBooks and Wave emphasize invoicing + simple profit/loss; Zoho Books adds budgeting and multi-entity; Bill.com focuses on payables/AP with approval workflows.
- **WHY IT MATTERS FOR SOLO:** These define the **baseline** a PFA owner already expects: key metrics + income/expense chart + recent transactions + quick actions. SOLO must meet this baseline, then differentiate by (a) a first-class **tax estimate** panel, (b) **threshold** warnings, and (c) **deadline** visualization — the three things mainstream accounting tools treat as secondary.

---

## Reusable Design Patterns

Patterns extracted across the products above (these are the reusable, product-agnostic ideas for SOLO):

1. **Key-metrics strip first.** A top row of 3–5 headline numbers (cash on hand, revenue this period, net profit, estimated tax due, cash-threshold status) before any chart. *(Mercury, LivePlan, QuickBooks/Xero baseline.)*
2. **One dataset, multiple zoom levels.** A single source of truth rendered at weekly / monthly / yearly zoom, so numbers never disagree. *(Float.)*
3. **Plan vs. actual, side by side, per period.** Budget/forecast line alongside the actual line, with a plain-language "what changed and why" caption. *(LivePlan.)*
4. **Base forecast + non-destructive scenarios.** Overlay "what-if" scenarios on top of (never inside) the base line, with one-click merge and side-by-side comparison. *(Float.)*
5. **Actuals auto-converge the projection.** Each new actual updates the forecast, charts, and variances automatically; no re-typing. *(LivePlan, Float.)*
6. **Single color-anchored cash line with red-zone flagging.** One line that visibly turns red as it approaches a floor, with drill-down to "which transactions take you there." *(Float.)*
7. **Settable threshold with advance warning.** A user-adjustable floor (default 0) that the dashboard flags *before* the projected balance crosses it — applicable to cash and to cost categories. *(Float, LivePlan variance.)*
8. **Tax as a first-class, derived tab.** Tax estimate computed from the same income/expense data as cash, shown in its own tab, in plain language, with a "set aside" amount. *(Piggy, TaxGuru, TaxJar, A2X.)*
9. **Per-jurisdiction tax/VAT breakdown with registration thresholds.** Break tax down by jurisdiction and surface when a registration threshold is crossed. *(TaxJar.)*
10. **Payout→income→VAT transparency.** Show exactly how each payment-processor payout is split into income, fees, and VAT. *(A2X.)*
11. **Deadlines as concrete, time-ordered calendar events.** Tax obligations (CASS, installments, VAT) shown as dated, time-stamped, upcoming events — not vague reminders. *(Xolo recurring-obligation model.)*
12. **Compliance as a headline dashboard element.** "Upcoming deadlines / compliance status" promoted near the top, matching how a solo owner thinks. *(Xolo.)*
13. **Insights that drill to source transactions.** An AI/insight panel whose every claim links down to the underlying transactions. *(Mercury.)*
14. **Recurring auto-generated "monthly review" with recommended actions.** A periodic plain-language summary ending in concrete next steps (e.g., "set aside X for next month's CASS"). *(LivePlan.)*
15. **Two empty-state types, action-oriented.** Distinguish "initial (no data yet)" from "zero results (after a filter)"; use imperative language ("Connect your bank") and in-context teaching for a brand-new, empty dashboard. *(Supabase DS, NN/g.)*
16. **Data-freshness / completeness indicator.** "Data as of …, last synced …, N items pending" so the user knows how much to trust the current numbers; forecast reliability scales with months of actuals. *(Float, LivePlan.)*
17. **Read-only, one-way data connection as a trust signal.** Explicitly state the tool reads (never edits) the books/bank. *(LivePlan, Float.)*
18. **Responsive: one data model, multiple surfaces.** Multi-panel master-detail "workspace" on desktop; stacked tabs on mobile; identical numbers everywhere. *(Piggy.)*
19. **Density earned by drill-down, capped by AI summary.** Start low-density; let the user drill down/up; offer a short natural-language recap to reduce number overload. *(Planful, Mercury.)*
20. **Meet the baseline, then differentiate.** Provide the expected key-metrics + income/expense chart + recent transactions + quick actions, then differentiate on tax, thresholds, and deadlines. *(Mainstream SaaS baseline.)*

---

## Recommendations for SOLO

> **The following is my own analysis and recommendation, not a sourced fact.** It is derived from the patterns above and tailored to a Romanian PFA (persoană fizabilă) starting FY2026, delivered as a web dashboard.

**R1 — Lead with a 5-number "PFA cockpit."** Top strip: (1) Cash on hand, (2) Revenue this month, (3) Net profit this month, (4) Estimated tax to set aside (CASS + income tax + VAT, broken out), (5) Cash-threshold status (safe / warning). This is the single most important screen; a PFA owner should know their position in 5 seconds without opening any report.

**R2 — Make "Tax to set aside" a headline number, not a buried report.** Compute it live from the same income/expense data as cash (Piggy pattern). Show the split (CASS / income tax / VAT) and a recommended monthly set-aside amount. This is SOLO's primary differentiator vs. mainstream accounting tools.

**R3 — Ship a settable cash floor with advance warnings (Float pattern).** Default 0, user-adjustable. Warn *before* the projected balance crosses it. Also apply threshold logic to cost categories (e.g., "software spend is over budget").

**R4 — Build a dedicated "Deadlines" panel as a first-class, time-ordered calendar.** List CASS (monthly), income-tax installments, VAT (monthly/quarterly), and annual declarations with concrete due dates, days-remaining, and a "paid / pending / overdue" status. Borrow Xolo's date-anchored, time-stamped recurring-obligation model. This is the second key differentiator.

**R5 — Use one cash line with a red zone + drill-down (Float pattern).** A single projected-cash line that turns red near the floor, with click-through to "which transactions take you there." Pair with a base-forecast + non-destructive "what-if" scenario overlay (e.g., "what if I lose my biggest client").

**R6 — Show plan-vs-actual per month with a plain-language caption (LivePlan pattern).** "Revenue landed short by X; spending on Y ran over. Here's what to do." End each month with an auto-generated review + recommended actions.

**R7 — Add a data-freshness / completeness indicator (Float + LivePlan pattern).** "Data as of …, last synced …, N transactions pending categorization." Explicitly state that forecast reliability improves with ~3 months of actuals, and degrade gracefully (show a plan, not false precision) when data is thin — critical for a brand-new FY2026 PFA.

**R8 — Design the initial empty state as onboarding (Supabase + NN/g pattern).** Because SOLO launches empty at the start of FY2026, the first screen must: confirm the system works, explain the next step in imperative language ("Connect your bank account / enter your first invoice"), and teach in-context ("Add your income to see your CASS and income-tax estimate"). Never show a blank dashboard.

**R9 — Make every insight drill to source transactions (Mercury pattern).** Any AI/insight claim ("spending up 40%") must link to the underlying transactions. This is the core trust mechanism for a non-financial owner.

**R10 — Responsive master-detail layout (Piggy pattern).** Desktop: persistent left column (months/transactions) + center chart + right detail/read-out, all in sync. Mobile: the same views collapse to tabs (Overview / Cash / Tax / Deadlines / Transactions). One data model, identical numbers on all surfaces.

**R11 — Keep density low by default, earned by drill-down (Planful pattern).** Start with a low-density summary; let the user drill down/up; offer a short natural-language recap to reduce number overload for a non-financial PFA.

**R12 — State the data connection as read-only (LivePlan/Float pattern).** Explicitly tell the user SOLO reads (and never edits) their bank/accounting data — a low-cost, high-trust signal.

**R13 — Meet the mainstream baseline first, then differentiate (mainstream SaaS pattern).** Ship the expected key-metrics + income/expense chart + recent transactions + quick actions, so a PFA owner feels at home immediately. Then layer on the three differentiators: first-class tax estimate, threshold warnings, and deadline visualization.

---

## Sources (consolidated)

- Mercury — https://mercury.com/insights
- LivePlan — https://www.liveplan.com/features/performance-dashboard ; https://help.liveplan.com/understanding-the-numbers/performance-tracking-dashboard-and-industry-data/using-the-liveplan-dashboard
- Float — https://www.floatapp.com/ ; https://www.floatapp.com/xero-cash-flow-forecast ; https://floatapp.com/blog/float-video-demo
- Piggy (Webspero case study) — https://www.webspero.com/work/piggy-case-study/
- TaxGuru — https://taxguru.com
- TaxJar — https://www.taxjar.com
- A2X — https://www.a2xaccounting.com
- Xolo — https://www.xolo.io/zz-en ; https://www.xolo.io/zz-en/faq/xolo-leap/category/invoicing/article/how-to-use-the-recurring-invoices-feature
- Bonsai — https://hello.bonsai.com
- Planful — https://planful.com/why-planful/dashboards/
- QuickBooks — https://quickbooks.intuit.com
- Xero — https://www.xero.com
- FreshBooks — https://www.freshbooks.com
- Wave — https://www.waveapps.com
- Zoho Books — https://www.zoho.com/books
- Bill.com — https://bill.com
- Supabase Design System (empty states) — https://supabase.com/design-system/docs/ui-patterns/empty-states
- Nielsen Norman Group (empty states) — https://www.nngroup.com/articles/empty-states/

*Note: TaxDome and Kruza were in the study scope; their public dashboards are gated/less documented, so they contributed fewer directly quotable findings. The patterns above are drawn from the products with accessible documentation.*
