/**
 * TASK 7 — copy for the record pages: Venituri, Cheltuieli, Clienți, Declarații, Documente,
 * e-Factura.
 *
 * These pages repeat each other more than anywhere else in the app — the same tab names, the same
 * modal captions, the same „Niciun rezultat pentru căutare." — and each copy used to keep its own
 * copy-paste of the sentence. One key now, shared.
 */
import type { ExpenseStatus, FilingStatus, RevenueStatus, VatReturnStatus } from '../../data/types';
import type { ExpenseCategory } from '../../domain/fiscal/deductibility';
// PG-6g — the parked-list reason labels are exhaustive over the three reason unions PG-6f defined. The
// labels live here; the unions stay in `domain/fiscal/vat.ts`, which this phase may not edit.
import type { InputVatDeferredReason, InputVatUnresolvedReason, InputVatZeroReason } from '../../domain/fiscal/vat';
// B-94 — the dated status flag on the art. 298 alin. (1) 50 % cut. The dates live in the domain object;
// this module only says them, so no surface can restate one of them wrongly.
import type { VatVehicleRuleStatus } from '../../domain/fiscal/vat';
import { formatRoCalendarDate } from '../../domain/date';
import type { FiscalDateField } from '../../domain/aggregation';
import { validation } from './common';

export const revenues = {
  title: 'Venituri',
  subtitle: 'Facturi și notele fără factură emise de către dvs.',
  searchPlaceholder: 'Caută după nr. sau client…',
  add: 'Adaugă venit',
  addTitle: 'Adaugă venit',
  editTitle: (nr: string): string => `Editează ${nr}`,
  emptyTitle: 'Niciun venit în această categorie',
  emptyBody: 'Adăugați primul venit pentru a-l vedea aici.',
  added: (nr: string): string => `Venitul ${nr} a fost adăugat`,
  updated: (nr: string): string => `Venitul ${nr} a fost actualizat`,
  deleted: (nr: string): string => `${nr} a fost ștearsă`,
  documentTypes: {
    factura: 'Factură',
    nota: 'Notă fără factură',
  },
  documentTypeCell: {
    factura: 'Factură',
    nota: 'Notă f. factură',
  },
  documentNumberPlaceholder: 'FCT-2025-0045',
  /**
   * B-112 — the income category, now a field the person can set.
   *
   * The label must not read as a formality. Until B-112 the app had `tip` (a document type) and nothing
   * else, so a DPI receipt was indistinguishable from an activitate-independentă one and the estimate
   * omitted an entire income category — ANAF's Exemplul 3 pays CAS of 24.300 lei on it and the engine
   * produced 12.150. The hint therefore says what the choice changes, and says plainly that the app does
   * not guess it: DPI vs activitate independentă turns on the object of the contract under Legea 8/1996,
   * and ÎCCJ dec. nr. 1793 din 23 martie 2021 refused DPI characterisation for contracts merely labelled
   * as such. The taxpayer having a PFA settles nothing.
   */
  incomeCategory: {
    field: 'Categoria de venit',
    activitate_independenta: 'Activitate independentă — art. 67',
    drepturi_de_proprietate_intelectuala: 'Drepturi de proprietate intelectuală — art. 70',
    hint:
      'Cele două categorii nu se impun laolaltă. Venitul din art. 70 are cota forfetară de cheltuieli de ' +
      '40 % din brut (art. 72 alin. (2)), se cumulează cu venitul din art. 67 la un singur test de plafon ' +
      'pentru CAS (art. 148 alin. (3)) și merge pe o altă literă la CASS (art. 155 alin. (1) lit. c), nu ' +
      'lit. b)). Aplicația nu ghicește categoria: linează pe ce ați declarat.',
  },
  /**
   * B-112 — the object of the contract, which is the fact the category turns on. Recorded beside the
   * category so the pair is checkable; where the two disagree the app reports the contradiction and posts
   * nothing, rather than choosing between two answers the person gave.
   */
  dpiContractType: {
    field: 'Obiectul contractului',
    none: '— nu declar —',
    cesiune_licenta: 'Cesiune / licență de drepturi patrimoniale (art. 40 din Legea 8/1996)',
    contract_de_comanda: 'Contract de comandă / antrepriză (art. 47 din Legea 8/1996)',
    hint:
      'Limita dintre art. 70 și art. 67 trece prin obiectul contractului, nu prin titlul hârtiei. Cesiunea ' +
      'și licența transferă drepturi patrimoniale și produc venit de la art. 70; contractul de comandă îl ' +
      'plătește pe autor să creeze și să predea, fără transfer de drepturi, și este venit din art. 67. ' +
      'ÎCCJ, secția de contencios administrativ și fiscal, decizia nr. 1793 din 23 martie 2021 a refuzat ' +
      'calificarea de drepturi de proprietate intelectuală pentru contracte intitulate „cesiune de drepturi ' +
      'de autor” care acopereau, în fapt, activitate de tip cold-call.',
  },
  /**
   * B-112 — the art. 72 alin. (3) / art. 72¹ alin. (2) exclusion set. One field, two consequences, and the
   * hint says both, because a person who reads only „fără cotă forfetară” would not see that the same flag
   * also takes the sum out of CAS.
   */
  dpiExcludedKind: {
    field: 'Exceptie de la cota forfetară',
    none: '— niciuna —',
    mostenitori: 'Venit încasat de moștenitori / de reprezentanții legali ai autorului',
    drept_de_suita: 'Drept de suită',
    remuneratie_copia_privata: 'Remunerație compensatorie pentru copia privată',
    hint:
      'Același set are două consecințe, și aplicația le citește dintr-un singur câmp: sumele de mai jos nu ' +
      'primesc cota forfetară de 40 % (art. 72 alin. (3) și art. 72^1 alin. (2)) și, în plus, sunt excluse ' +
      'de la CAS — art. 137 alin. (1) lit. b^1) spune „cu excepția veniturilor prevăzute la art. 72 alin. ' +
      '(3)”. Nu sunt două întrebări separate și nu pot fi răspunse diferit.',
  },
  /**
   * B-112 — the category shown on the row. The activitate-independentă wording is deliberately the shorter
   * one: it is what every pre-B-112 record is, and a row that shouted about the default would read as a
   * warning on records that carry no finding.
   */
  categoryCell: {
    activitate_independenta: 'art. 67',
    drepturi_de_proprietate_intelectuala: 'art. 70 · DPI',
  },
  /**
   * B-112 — the marker on a row whose declared category and declared contract object contradict each other.
   *
   * **B-149 (brief 73): this used to be ONE tag, and it was wrong twice over.** It read
   * „declarație contradictorie — venit nepostat” and was gated on `isDpiIncome`, so (a) an art. 67 receipt
   * carrying the same contradiction showed no tag at all, while the coverage surface had reported it since
   * B-117 — the app half-reported one fact, which is worse than either extreme — and (b) had it shown on
   * that row, „venit nepostat” would have been **false there**: that income is posted and is inside the
   * figure. `estimateBasis.dpiCoverageGaps` says so in the shape of its own rows — the art. 67
   * contradiction carries `amount: null` precisely because the estimate already computed on that sum, while
   * the art. 70 one is out of the figure.
   *
   * So there are now two tags, and each is true of the record it marks. Which of the two fields is wrong
   * stays the person's call: `dpiRecordConflict` spells that out in the coverage row.
   */
  dpiConflictTagDpi: 'declarație contradictorie — venit nepostat',
  dpiConflictTagArt67: 'declarație contradictorie — venitul este postat la art. 67',
  clientSelectPlaceholder: '— alege clientul —',
  columns: {
    document: 'Document',
    type: 'Tip',
    client: 'Client',
    cui: 'CUI',
    date: 'Data',
    currency: 'Moneda',
    withoutVat: 'Fără TVA',
    vat: 'TVA',
    total: 'Total',
    status: 'Status',
  },
} as const;

export const expenses = {
  title: 'Cheltuieli',
  subtitle: 'Facturi și bonuri fiscale primite de la furnizori.',
  searchPlaceholder: 'Caută după nr. sau furnizor…',
  add: 'Adaugă cheltuială',
  addTitle: 'Adaugă cheltuială',
  editTitle: (nr: string): string => `Editează ${nr}`,
  emptyTitle: 'Nicio cheltuială în această categorie',
  emptyBody: 'Adăugați prima cheltuială pentru a o vedea aici.',
  added: (nr: string): string => `Cheltuiala ${nr} a fost adăugată`,
  updated: (nr: string): string => `Cheltuiala ${nr} a fost actualizată`,
  deleted: (nr: string): string => `${nr} a fost ștearsă`,
  documentTypes: {
    factura: 'Factură',
    bon: 'Bon fiscal',
  },
  documentTypeCell: {
    factura: 'Factură',
    bon: 'Bon fiscal',
  },
  documentNumberPlaceholder: 'FCT-09-112043',
  providerPlaceholder: 'SC … SA',
  deductibilityLabel: 'Categorie deductibilitate (CF art. 68)',
  deductibilityNone: '— fără categorie —',
  deductibilityNoneHint:
    'Fără categorie, cheltuiala este neclasificată și exclusă din calculul impozitului.',
  classify: 'Clasifică',
  totalDocuments: (n: number): string => `Total: ${n} ${n === 1 ? 'document' : 'documente'}`,
  columns: {
    document: 'Document',
    type: 'Tip',
    provider: 'Furnizor',
    cui: 'CUI',
    date: 'Data',
    currency: 'Moneda',
    withoutVat: 'Fără TVA',
    vat: 'TVA',
    total: 'Total',
    status: 'Status',
  },
  /**
   * TASK 10a (B-32) — the foreign-currency banner. A record written in EUR or USD is real data the app can
   * store, and it is NOT in the lei totals, because bringing it in needs a BNR rate and a legal basis the
   * assembler does not attach yet. The banner says so rather than letting the total quietly omit it.
   */
  foreignCurrencyLead: (n: number): string =>
    n === 1 ? 'O cheltuială este' : `${n} cheltuieli sunt`,
  foreignCurrencyTail:
    'într-o monedă pe care aplicația nu o poate aduce încă în lei, deci nu intră în cheltuielile deductibile.',
  /** The unclassified-expense banner: how many, and what happens to them. */
  unclassifiedLead: (n: number): string =>
    n === 1
      ? 'O cheltuială este neclasificată'
      : `${n} cheltuieli sunt neclasificate`,
  unclassifiedTail: 'în acest an fiscal și nu intră în cheltuielile deductibile (CF art. 68 alin. (4) și (7)).',
  /** The cap banner. */
  capTitle: 'Plafonul calculat',
  capHasOne: 'o cheltuială are',
  capHasMany: (n: number): string => `${n} cheltuieli au`,
  /** Names the reading that was applied, so the applied figure is never read as the only possible one. */
  capAppliedReading: 'plafonul măsurat pe baza art. 68 alin. (6) sub interpretarea «înregistrată» (pre-plafon).',
  capAppliedLead: (measure: string): string => `Plafon aplicat (${measure}):`,
  capAlternativeLead: '· cealaltă interpretare, post-plafon:',
  capCitation: (article: string, percent: number | undefined): string =>
    ` · ${article} · plafon ${percent}% din baza art. 68 alin. (6)`,
  measureWithVat: 'cu TVA inclus',
  measureWithoutVat: 'fără TVA',
  /**
   * PG-6f (B-30) — the third state. The engine refuses to pick a money measure when the VAT registration
   * state is undeclared, so a ceiling shown while the state is missing must say that the choice is not
   * established and name which of the two numbers is on screen. Naming neither, or naming one as if it
   * were decided, is the `vatExempt` habit in a new costume.
   */
  measureUndeclared: 'măsură nesetabilă — starea de înregistrare în TVA lipsește; afișată cea fără TVA',
  /** A legal ceiling the app cannot measure — a missing fact, not a completion error. */
  capBlockedOne: 'O cheltuială are',
  capBlockedMany: (n: number): string => `${n} cheltuieli au`,
  capBlockedTail:
    'un plafon legal care nu poate fi măsurat din datele înregistrate, deci nu intră în cheltuielile deductibile (CF art. 68 alin. (5)). Nu este o eroare de completare — este un fapt pe care aplicația nu îl deține.',
  capBlockedRest: (n: number): string =>
    `Celelalte ${n} sunt excluse pentru temeiuri identice sau analoage; fiecare poartă motivul ei.`,
  /**
   * TASK 10b — a ceiling the law states in euro, converted to lei. The banner has to say four things at
   * once: which reading was applied, at which rate, for which year, and that the other reading gives a
   * different number and the law does not settle which applies. A converted ceiling that does not name
   * its rate is the same defect B-32 was.
   */
  euroCapTitle: 'Plafonul în euro, convertit',
  euroCapAppliedReading:
    'plafonul exprimat în euro a fost convertit la media anuală BNR a anului plății, temeiul pct. 7 alin. (6) '
    + 'din Normele HG 1/2016; art. 9 alin. (3) lit. b) și alin. (4) CF dau un alt plafon, la cursul de la data '
    + 'plății, și legea nu stabilește care dintre cele două reguli se aplică — ambele sunt afișate.',
  euroCapCitation: (article: string): string => ` · ${article}`,
  euroCapRateLead: '· curs mediu anual',
  euroCapValidFor: (year: number): string => `pentru anul ${year}`,
  euroCapAlternativeLead: '· cealaltă citire, cursul BNR de la data plății:',
  euroCapAlternativeMissing: 'această citire nu poate fi măsurată din datele înregistrate:',
  euroCapProvisionalTail:
    'cursul mediu pentru acest an nu este încă publicat de BNR, deci plafonul este provizoriu și se recalculează '
    + 'singur când media definitivă intră în registru.',
  /**
   * B-137 — where a struck ceiling's rate came from, on the same line as the ceiling. The five-point note
   * below the banner explains the rule; this names the record behind the specific number on this row, and it
   * shows for a final rate too. A converted ceiling that cannot name its source is the same defect B-32 was.
   */
  euroCapProvenance: (used: { series: string; how: string; when: string; source: string }): string =>
    `· serie BNR ${used.series} · ${used.how} la ${used.when} · sursă ${used.source}`,
  /**
   * B-137 — an unmeasurable euro ceiling now says what would measure it. Before this the banner explained the
   * conflict and stopped, which left the person with a refusal and no next step; the entry form was already
   * able to record an annual average, nothing pointed at it.
   */
  capBlockedFix:
    'Media anuală a anului plății se poate înregistra manual, de pe ecranul de cursuri valutare. Până atunci '
    + 'plafonul rămâne nemăsurat, iar cheltuiala rămâne în afara totalului — nu este dedusă cu o valoare ghicită.',
  /**
   * TASK 10b — ledger records that entered the lei base only because a recorded BNR rate converted them.
   * The conversion is a legal act (art. 9 alin. (3) lit. b) + alin. (4)), so the rate that did it is shown
   * beside the record, not hidden behind a disclosure.
   */
  fxConvertedLead: (n: number): string =>
    n === 1
      ? 'înregistrare în valută a intrat în calcul la cursul BNR de la data plății'
      : 'înregistrări în valută au intrat în calcul la cursul BNR de la data plății',
  fxConvertedTail:
    ' (CF art. 9 alin. (3) lit. b) și alin. (4)); cursul, seria și sursa sunt afișate lângă fiecare.',
  fxConvertedRow: (currency: string, onDate: string, rate: string): string =>
    `${currency} · ${onDate} · curs ${rate}`,
  fxConvertedCarried: '· curs preluat din ultima zi bancară',
} as const;

/**
 * The deductibility categories in Romanian. The select and the cap banner used to print the internal
 * keys (`protocol`, `mandatory_professional_contribution`, `personal_or_family_use`) as if they were
 * words a person would use. Typed `Record<ExpenseCategory, string>`, so a new category in the rule set
 * is a compile error here rather than a raw key on screen.
 */
export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  personal_or_family_use: 'Cheltuială personală sau de uz familial',
  non_taxable_income_expense: 'Cheltuială cu venituri scutite de impozit',
  own_income_tax: 'Impozitul propriu pe venit',
  personal_insurance_premium: 'Primă de asigurare personală',
  donation: 'Donație',
  fine_or_penalty: 'Amendă sau penalitate',
  loan_principal_repayment: 'Rambursare de principal de împrumut',
  depreciable_asset_purchase: 'Achiziție de mijloc fix',
  inventory_shortage_uncovered: 'Lipsă de stoc neacoperită',
  tax_borne_for_beneficiary: 'Impozit plătit pentru altul',
  depreciation_personal_patrimony: 'Amortizare din patrimoniul personal',
  sponsorship_or_mecenat: 'Sponsorizare sau mecenat',
  corruption_related: 'Cheltuială legată de fapte de corupție',
  owner_social_contributions: 'Contribuții sociale ale titularului',
  employer_social_contributions: 'Contribuții sociale ale angajatorului',
  rent_business_space: 'Chirie pentru spațiul de lucru',
  bank_interest: 'Dobânzi bancare',
  postal_and_telecom: 'Cheltuieli poștale și telecomunicații',
  energy_and_water: 'Energie și apă',
  business_space_upkeep: 'Întreținerea spațiului de lucru',
  depreciation_business_asset: 'Amortizarea mijloacelor fixe din activitate',
  vehicle_related: 'Cheltuieli cu autoturismul',
  protocol: 'Cheltuieli de protocol',
  social_expenses: 'Cheltuieli sociale',
  private_scholarship: 'Bursă privată',
  private_pension_contribution: 'Contribuție la pensie privată',
  occupational_pension_contribution: 'Contribuție la pensie ocupațională',
  pepp_contribution: 'Contribuție la un produs de pensie personală paneuropeană',
  voluntary_health_insurance: 'Asigurare de sănătate voluntară',
  sports_subscription: 'Abonament sportiv',
  professional_body_dues: 'Cotizație la colegiul profesional',
  mandatory_professional_contribution: 'Contribuții profesionale obligatorii',
  etf_purchase: 'Achiziție de unități ETF',
  home_office_shared_cost: 'Cheltuială comună pentru biroul de acasă',
  comodat_immovable_share: 'Cota pentru imobil dat în comodat',
};

export const clients = {
  title: 'Clienți',
  count: (n: number): string =>
    `${n} ${n === 1 ? 'client înregistrat' : 'clienți înregistrați'} în evidența dvs.`,
  searchPlaceholder: 'Caută client…',
  add: 'Adaugă client',
  addTitle: 'Adaugă client',
  editTitle: (denumire: string): string => `Editează ${denumire}`,
  emptyTitle: 'Niciun client',
  emptyBody: 'Adăugați primul client pentru a-l selecta la emiterea facturilor.',
  added: (denumire: string): string => `Clientul ${denumire} a fost adăugat`,
  updated: (denumire: string): string => `Clientul ${denumire} a fost actualizat`,
  denumire: 'Denumire',
  denumirePlaceholder: 'SC EXEMPLU SRL / Nume (PFA)',
  cuiCnp: 'CUI / CNP',
  cityPlaceholder: 'Oraș',
  typePerson: 'Persoană',
  typeCompany: 'Firmă',
  columns: {
    denumire: 'Denumire',
    cuiCnp: 'CUI / CNP',
    email: 'Email',
    phone: 'Telefon',
    city: 'Oraș',
    type: 'Tip',
  },
} as const;

export const declarations = {
  title: 'Declarația unică (D212)',
  // PG-5 (B-34): the page is annual now. The record it registers is the one return this profile
  // actually owes — a Declarația Unică 212 per fiscal year, filed by 25 May of the following year
  // (CF art. 122 alin. (3)) — not a monthly row for an obligation that does not exist. TASK 9 had
  // already removed the monthly cadence claim from the old subtitle; this removes the shape that
  // implied it.
  subtitle: 'Câte o declarație pentru fiecare an fiscal declarat — nu pe lună',
  searchPlaceholder: 'Caută după an fiscal…',
  add: 'Adaugă declarație anuală',
  addTitle: 'Adaugă declarație anuală',
  editTitle: (taxYear: number): string => `Editează declarația pentru ${taxYear}`,
  emptyTitle: 'Nicio declarație anuală înregistrată',
  // States the obligation without pretending the app knows it was met: the term is the rule engine's,
  // the article is the citation the rule carries, and whether a return is owed yet is a fact about the
  // year, not a prompt to invent one.
  emptyBody: 'Aplicația înregistrează aici declarațiile pe care le-ai depus sau le pregătești. Termenul și anului declarat i le dă motorul de reguli.',
  added: (taxYear: number): string => `Declarația pentru ${taxYear} a fost adăugată`,
  updated: (taxYear: number): string => `Declarația pentru ${taxYear} a fost actualizată`,
  markFiled: 'Marchează ca depusă',
  filed: (taxYear: number): string => `Declarația pentru ${taxYear} este înregistrată ca depusă`,
  form: 'Formular',
  taxYear: 'An fiscal declarat',
  filedOn: 'Data depunerii',
  filedOnHint: 'Se completează doar când declarația a fost efectiv depusă.',
  filedOnRequired: 'O declarație marcată „Depusă” are nevoie de data depunerii.',
  reference: 'Număr de înregistrare / referință',
  referenceHint: 'Dacă ANAF ți-a dat un număr de înregistrare, notează-l aici.',
  statusRequired: 'Alege starea declarației.',
  columns: {
    taxYear: 'An fiscal',
    form: 'Formular',
    status: 'Status',
    filedOn: 'Depusă la',
    reference: 'Referință',
  },
  /**
   * PG-5b: the wording for the read-only monthly table is gone with the table. It said the rows were kept
   * (they were the only place some of those figures existed) and refused to let them mean more than they
   * do — they are not filings, and the app would not treat one as proof that anything was submitted. The
   * rows are now dropped by the v10→v11 step rather than shown, and the page has one vocabulary: the
   * annual return's.
   */
} as const;

/**
 * PG-6g — the periodic VAT return (formular 300) and the CF art. 322 fiscal period.
 *
 * Three disciplines the wording has to keep, all of them enforced here rather than at the call site:
 *
 * - **Nothing says a return was or will be filed.** B-56 is open precisely because success messages
 *   already promise operations that do not happen, and this panel sits next to one of them. No key here
 *   reads as a confirmation of a submission; the closest is `recordFiled`, which says the app recorded
 *   that *you* filed it.
 * - **A derived answer and an answered question are different sentences.** `derivedLead` attributes the
 *   conclusion to the article; `confirmedLead` attributes it to the person. Separate keys, so a call site
 *   cannot collapse them into one wording.
 * - **The statutory default is the law's, not the app's.** `interimLead` names art. 322 alin. (1) as the
 *   source of the monthly default, which is what keeps „we do not guess a cadence" true while still
 *   removing the dead end the brief names.
 */
export const vatReturn = {
  sectionTitle: 'Deconturi TVA periodice (formular 300)',
  sectionLead:
    'Regimul periodic de TVA nu se alege: se derivă din art. 322 din Codul fiscal. Aplicația întreabă '
    + 'faptele pe care legea le cere și arată calculul, nu o listă de opțiuni.',
  notRegisteredLead:
    'Regimul periodic se stabilește doar pentru o persoană înregistrată în scopuri de TVA. Completează '
    + 'starea de înregistrare în Setări → Fiscal.',

  // ── the fiscal period, in the states the derivation can be in ──
  derivedLead: (citation: string): string => `Perioada fiscală rezultă din ${citation}.`,
  confirmedLead: (confirmedOn: string): string =>
    `Perioada fiscală este alegerea dumneavoastră, consemnată la ${confirmedOn}. Aplicația nu a putut-o deriva.`,
  askLead: 'Aplicația nu poate stabili perioada fiscală din faptele înregistrate. Întreabă, nu ghicește.',
  interimLead: (basis: string): string => `Până la răspuns, rămâne regula legală: ${basis}`,
  whyAsked: 'De ce se întreabă în loc să se calculeze',
  arithmetic: 'Calculul',
  questions: 'Ce lipsește',
  answerHeading: 'Sau confirmă dumneavoastră perioada',
  answerLead: (rule: string): string =>
    `Regula pe care se întreabă: ${rule} Dacă o confirmi, răspunsul rămâne al dumneavoastră.`,
  chooseMonth: 'Depun lunar',
  chooseQuarter: 'Depun trimestrial',
  confirmedBadge: 'alegerea dumneavoastră',
  derivedBadge: 'derivat din lege',

  // B-103 — there is no `periodicityLabels` map here any more. The sentence naming this year's fiscal
  // period is produced once, by `vatPeriodicityYearSentence` in `domain/fiscal/vatPeriodicity.ts`, and both
  // the panel and the completeness channel call it. A copy-side label map was how the panel came to say
  // „lună calendaristică” for a year that since B-101 opens with a quarterly return: two spellings of one
  // fact, only one of which knew about the segment.

  capHeading: 'Plafonul de 100.000 euro în lei',
  capRate: (rate: string, date: string): string => `Curs BNR ${rate} valabil pentru ${date}`,
  capNotHardcoded:
    'Echivalentul în lei nu este scris nicăieri în aplicație: se calculează prin stratul valutar din '
    + 'cursul BNR valabil pentru 31 decembrie a anului precedent, potrivit pct. 103 alin. (2) din normele '
    + 'HG 1/2016.',
  capUnresolved: 'Plafonul nu poate fi exprimat în lei fără un curs BNR înregistrat.',

  // ── the calendar ──
  // B-64 — the heading used to say „pentru acest an”, and the calendar stopped being only that: the art.
  // 324 alin. (5) notification for FY2027 is dated 25 februarie 2028 and is surfaced here on purpose.
  // A row that is honest about its own year is better than a heading that quietly excludes it.
  calendarHeading: 'Calendarul depunerilor: termenele cunoscute, inclusiv obligațiile care cad în ani următori',
  calendarEmpty:
    'Nicio obligație de depus care să poată fi datată: fără perioadă fiscală stabilită, un decont nu are '
    + 'perioada acoperită, deci nu are termen. Aplicația nu inventează unul.',
  columns: {
    obligation: 'Obligație',
    dueOn: 'Termen',
    payment: 'Plată',
    citation: 'Temei',
    status: 'Înregistrare',
  },
  obligationKinds: {
    decont: 'Decont de taxă',
    mentiuni_annuale: 'Declarație de mențiuni (25 ianuarie)',
    mentiuni_achizitie: 'Declarație de mențiuni (achiziție intracomunitară)',
    // B-64 — a written notification, not a return. It is its own kind precisely because it is not a
    // decont and not a mențiuni: it carries no tax figure and discharges nothing.
    notificare_art324: 'Notificare scrisă (formular 392B)',
  } as const,
  /**
   * B-64 — widened, not duplicated. art. 326 alin. (1) ties the payment to the deconturi and declarații
   * that carry a tax; the art. 324 alin. (5) notification carries none, and a blanket „plata se face în
   * aceeași zi” above a table that now holds a notification would invent a sum nobody owes.
   */
  paymentSameDay:
    'Când obligația produce o sumă de plată, plata se face în aceeași zi cu depunerea (art. 326 alin. (1) CF). Notificarea scrisă de la art. 324 alin. (5) nu produce nicio sumă de plată.',
  /** B-64 — the cell for an obligation that produces no sum to pay. A dash would read as an omission. */
  noPaymentDue: 'fără sumă de plată',
  recordFiling: 'Înregistrează depunerea',
  recordFiled: (label: string): string => `Depunerea pentru ${label} a fost consemnată în aplicație`,
  filedBadge: 'Depusă',
  notFiledBadge: 'Neconsemnată',
  filedOnField: 'Data depunerii',
  referenceField: 'Număr de înregistrare / referință',
  undoFiled: 'Anulează consemnarea',
  noBackfill:
    'Un termen care apare aici este o obligație stabilită de lege, nu o depunere. Lipsa unei consemnări '
    + 'înseamnă că nimeni nu a înregistrat-o, nu că nu a existat.',

  // ── where 6f's numbers land ──
  d300Heading: 'Unde se așază cifra de TVA deductibilă în formularul 300',
  d300Lead:
    'Nu este un singur număr pe o singură rubrică. Totalul calculat de aplicație nu este egal cu rd. 30, '
    + 'pentru că limitarea de 50 % și cota pro-rata cad parțial în afara rd. 20–28.',
  d300Columns: { row: 'Rubrică', title: 'Denumire', treatment: 'Ce pune aplicația aici' },
  d300NotAFacsimile: 'Aici este schema rubricilor, nu facsimilul formularului.',

  // ── B-94 — where the 50 % comes from, and what is open about it ──
  /**
   * The dated status flag on the 50 % vehicle cut, in the two places that already explain the 50 %: the
   * Form 300 rubric layout on Declarații and the input-VAT disclosure on Dashboard. **One producer, two
   * call sites** — a second spelling of these sentences is the B-70 defect class. Every date and every
   * reference is interpolated from `VAT_VEHICLE_ART298_STATUS`; none is typed here, because a date typed
   * into a sentence is a date nobody re-checks.
   *
   * Two things the wording must not do, and does not: it does not give the domestic rule an end date
   * (art. 298 alin. (1) has none), and it does not call the extension *rejected* — only *not adopted, as
   * of a stated date* is supported.
   */
  cidStatusHeading: 'De unde vine limitarea de 50 % și ce este deschis în jurul ei',
  cidStatusAnchor: (s: VatVehicleRuleStatus): string =>
    `Limitarea la 50 % este ${s.anchor}: regulă internă, fără termen de valabilitate și fără nicio trimitere `
    + 'la o derogare a Uniunii Europene. Aplicația o aplică și pentru 2027, pentru că abrogarea ei cere un act legislativ.',
  cidStatusDerogation: (s: VatVehicleRuleStatus): string =>
    `${s.derogation.name} (CELEX ${s.derogation.celex}) este derogarea care face regula compatibilă cu `
    + `${s.derogation.derogatesFrom} și se aplică până la ${formatRoCalendarDate(s.derogation.endsOn)} (${s.derogation.endsBy}).`,
  cidStatusExtension: (s: VatVehicleRuleStatus): string =>
    `Prelungirea până la ${formatRoCalendarDate(s.extension.wouldEndOn)} a fost propusă la `
    + `${formatRoCalendarDate(s.extension.proposedOn)} (${s.extension.instrument}, dosar ${s.extension.file}, `
    + `${s.extension.councilDocument}) și nu fusese adoptată la data verificării, `
    + `${formatRoCalendarDate(s.asOf)}. Dosarul este încă deschis, iar aplicația nu anticipează soarta lui.`,
  cidStatusRisk: (s: VatVehicleRuleStatus): string =>
    `Dacă derogarea expiră fără înlocuire, ${s.anchor} rămâne în vigoare, dar devine contrară `
    + `${s.postLapse.contraryTo}. În cazul acela dreptul de deducere ar putea fi mai larg decât calculul `
    + 'aplicației, nu mai îngust.',
  cidStatusGap: (s: VatVehicleRuleStatus): string =>
    `Ce nu calculează aplicația: la expirarea derogării revine ${s.postLapse.deemedSupplyReturns}, deci `
    + 'utilizarea personală a bunului redevine livrare impozabilă. Aplicația nu face acest calcul și nu '
    + 'completează nimic din oficiu.',

  // ── the three parked lists from 6f ──
  parkedHeading: 'Linii excluse din total, cu motivul',
  parkedLead:
    'Aceste linii nu intră în niciun total. Motivele sunt cele pe care le-a stabilit decizia D-VAT-3, nu '
    + 'o clasificare inventată aici.',
  parkedColumns: { reason: 'Motiv', count: 'Linii', amount: 'Valoare TVA' },
  parkedEmpty: 'Nicio linie parcată.',
  unfiledFigure: 'Cifra de mai jos este calculată, nu depusă.',
  /**
   * Exhaustive over the three reason unions in `domain/fiscal/vat.ts`. `satisfies Record<…, string>` is
   * what makes a new reason a compile error here rather than a raw token on screen — the same discipline
   * `coverage.reasonLabels` uses on the dashboard side.
   */
  parkedReasonLabels: {
    fara_drept_nicio_inregistrare: 'fără drept de deducere: nicio înregistrare în scopuri de TVA',
    cod_anulat_perioada: 'cod de TVA anulat pentru perioada respectivă',
    furnizor_cod_anulat: 'furnizor cu cod de TVA anulat sau inactiv la dată',
    furnizor_art310: 'furnizor scutit de TVA conform art. 310 — remedierea e stornarea, nu deducerea',
    destinatie_fara_drept: 'achiziția deservește o operațiune fără drept de deducere',
    alcool_tutun_fara_revanzare: 'alcool și tutun fără revânzare',
    vehicul_neutilizat: 'vehicul nefolosit deloc în activitate — zero, nu 50 %',
    document_fara_e_factura: 'B2B intern fără document în RO e-Factura',
    document_nedeclarat: 'tipul documentului nu a fost declarat',
    document_simplificata_100_400_eur: 'factură simplificată 100–400 euro, fără ordin MF în vigoare',
    document_simplificata_fara_cod_cumparator: 'factură simplificată sub 100 euro fără cod de TVA al cumpărătorului',
    pro_rata_nedeclarat: 'cotă pro-rata nedeclarată — art. 300 CF nu are nicio excepție de prag',
    destinatie_nedeclarata: 'destinația achiziției nu a fost declarată',
    furnizor_nedeclarat: 'starea furnizorului nu a fost declarată',
    record_neconvertit: 'înregistrare în valută fără curs BNR înregistrat',
    plata_ammnata_regim_propriu: 'amânată de regimul propriu de TVA la încasare, până la plată',
    plata_ammnata_furnizor: 'amânată de regimul de TVA la încasare al furnizorului, până la plată',
  } satisfies Record<
    InputVatZeroReason | InputVatUnresolvedReason | InputVatDeferredReason,
    string
  >,
  parkedWhyMissing: 'motivul nu este descris în stratul de decizie',
} as const;

/** The three VAT return states. Deliberately not `recordStatus`: the monthly vocabulary is retired. */
export const vatReturnStatusLabels = {
  in_pregatire: 'În pregătire',
  depusa: 'Depusă',
  respinsa: 'Respinsă',
} satisfies Record<VatReturnStatus, string>;

/**
 * The four record states, in the words a person reads. The tabs use the plural, the select uses the
 * singular — the same state, agreed with what it counts.
 *
 * B-56: `transmisa` is gone from both maps. It is the one word in `StoredStatusCode` with no live
 * producer (see the note on that union in `src/data/types.ts`): no revenue or expense schema accepts it
 * and the monthly row that wrote it is dropped by the v10→v11 migration. A label that said „Transmise”
 * therefore claimed a transmission nobody in this app performs, and it was unreachable anyway — no page
 * renders it. The maps are keyed by `RevenueStatus`, which is exactly what the registers can hold.
 */
export const recordStatus = {
  tabs: {
    inregistrata: 'Înregistrate',
    'in-asteptare': 'În așteptare',
    respinsa: 'Respinse',
  } satisfies Record<RevenueStatus, string>,
  /** The badge and select wording — the same states, agreed with the single record they describe. */
  labels: {
    inregistrata: 'Înregistrată',
    'in-asteptare': 'În așteptare',
    respinsa: 'Respinsă',
  } satisfies Record<RevenueStatus, string>,
  /**
   * PG-5: the annual return's own three states, kept separate from `labels` above on purpose. The
   * monthly words describe a record in this app; `depusa` is the only word in the app that says a
   * return reached ANAF, and sharing a label map between the two is how a monthly 'Înregistrată' could
   * be read as a filing.
   */
  filingLabels: {
    in_pregatire: 'În pregătire',
    depusa: 'Depusă',
    respinsa: 'Respinsă',
  } satisfies Record<FilingStatus, string>,
  revenueLabels: {
    inregistrata: 'Înregistrată',
    'in-asteptare': 'În așteptare',
    respinsa: 'Respinsă',
  } satisfies Record<RevenueStatus, string>,
  expenseLabels: {
    inregistrata: 'Înregistrată',
    respinsa: 'Respinsă',
  } satisfies Record<ExpenseStatus, string>,
  /**
   * PG-1 — the lead of the per-record note that says the row is NOT in the estimate figure. The motive
   * after it is the shared reason label from `dashboard.estimate.coverage.reasonLabels`, so the register
   * row and the hero row name the same cause with the same words.
   *
   * It belongs to the record, not to the register: the status badge above it answers „ce stare are
   * înregistrarea?”, this answers „intră în calcul?”. A record can be `Înregistrată` and still not enter.
   */
  notInEstimate: 'nu intră în estimare',
} as const;

/**
 * PG-2 — the field a fiscal date actually came from, in Romanian.
 *
 * Keyed by `domain/aggregation.ts FiscalDateField`, which is the SAME three values as
 * `domain/fx/ledger.ts LedgerDateSource` and the same three values `auditFiscalDates` reports. The
 * type is exhaustive, so a fourth spelling of the idea is a compile error rather than a fourth
 * sentence on screen (B-70's mistake, prevented rather than re-litigated).
 */
export const fiscalDateSource: Record<FiscalDateField, string> = {
  date: 'data documentului',
  collected: 'data încasării',
  paid: 'data plății',
};

/**
 * B-139 — the two money fields a foreign-currency conversion names, in Romanian.
 *
 * `domain/fx/ledger.ts normaliseRecord` used to write
 *   `(câmpul „${field}" al înregistrării …)`
 * which put `valoareFaraTva` / `tva` on a person's screen: the third instance of one leak after B-55's
 * `FiscalBase` and B-138's `CapBase`. The map is exhaustive over the field union the converter walks —
 * `ledger.ts` keys its own `fields` array off `keyof typeof moneyFieldLabels` — so a money field added to
 * the conversion is a compile error here before it is a raw identifier on a screen.
 */
export const moneyFieldLabels: Record<'valoareFaraTva' | 'tva', string> = {
  valoareFaraTva: 'valoarea fără TVA',
  tva: 'TVA',
};

/**
 * PG-2 — the money date: the day the money actually moved.
 *
 * `docs/ai/research/37_cash_basis_date_semantics.md` §5 fixes what this app may claim about the
 * difference between a document date and a money date. These keys ARE those sentences; they live in one
 * module so the revenue form, the expense form and the RJIP register cannot each grow their own
 * paraphrase of art. 68. What §5 forbids is deliberately absent: no key here says the document date
 * determines the fiscal year, that the law presumes document date = money date, or that the app's
 * fallback when a money date is missing is mandated by the Cod fiscal. The fallback is a display
 * default, and `revenueEmpty`/`expenseEmpty` (forms) and `documents.rjip.postedOnDocumentDate`
 * (the register) say so in those words.
 *
 * The two field labels are the words `data/schema.ts` already uses for the same two fields.
 */
export const moneyDate = {
  revenueField: 'Data încasării',
  expenseField: 'Data plății',
  optionalTag: '(opțional)',
  /** research/37 §5 sentence 2, split along the clause each form owns. */
  revenueHint:
    'Dacă ai încasat într-un an fiscal diferit de cel al documentului, completează data încasării: '
    + 'suma se duce în anul fiscal în care a intrat banul.',
  expenseHint:
    'Dacă ai plătit într-un an fiscal diferit de cel al documentului, completează data plății: '
    + 'suma se duce în anul fiscal în care a intrat banul.',
  /** research/37 §5 sentence 3: absence is a legal state, not an unfinished field. */
  revenueEmpty:
    'Poți lăsa câmpul gol cât timp banul nu s-a mișcat: fără încasare suma nu este venit brut '
    + '(art. 68 alin. (2) lit. a) din Codul fiscal).',
  expenseEmpty:
    'Poți lăsa câmpul gol cât timp banul nu s-a mișcat: fără plată cheltuiala nu este deductibilă '
    + '(art. 68 alin. (4) lit. b) din Codul fiscal).',
  /**
   * 12C (B-38) — the default stated where the decision is made, not only where its result is read.
   *
   * `revenueEmpty` / `expenseEmpty` tell the person that an empty money date is a legal state: no
   * collection, no venit brut. What they do NOT say — and what the engine then does anyway — is that a
   * record with no money date is attributed to the fiscal year of its DOCUMENT date, because
   * `revenueFiscalDate` / `expenseFiscalDate` fall back to `date` when nothing else is recorded. So the
   * form promised one consequence and the estimate produced another: the default was visible on the row
   * (`FiscalDateNote`) and on the estimate (B-67's `assumedFromDocument`) but not on the two fields where
   * the person chooses. That is B-38 surviving its own fix — the assumption becomes invisible exactly where
   * it is being made.
   *
   * One key, not two: the revenue form and the expense form must not each grow their own paraphrase of the
   * same stand-in (the reason `moneyDate` is one module at all). The wording is B-67's vocabulary, and it
   * stays inside what `docs/ai/research/37_cash_basis_date_semantics.md` §5 permits — it names the
   * fallback as the app's own assumption and denies, in the same breath, that any provision presumes
   * document date = money date. It does not tell the person which date to record: that stays their call.
   */
  fallbackDefault:
    'Fără dată de încasare sau de plată înregistrată, aplicația alege anul fiscal al datei documentului. '
    + 'Aceasta este presupunerea aplicației, nu o regulă din Codul fiscal: legea alege anul după banul '
    + 'încasat sau plătit (art. 68 alin. (2) lit. a) și alin. (4) lit. b) din Codul fiscal). '
    + 'Completează data de mai sus ca s-o corectezi.',
  /** research/37 §5 sentence 1, the claim the whole surface rests on. */
  rule:
    'Anul fiscal rezultă din data încasării, respectiv din data plății — nu din data documentului '
    + '(art. 68 alin. (2) lit. a) și alin. (4) lit. b) din Codul fiscal).',
  /** The register row: which year the money date put this record in, when it is not the document's year. */
  collectedIn: (year: number): string => `încasat în ${year}`,
  paidIn: (year: number): string => `plătit în ${year}`,
  /**
   * B-67 — the assumption stated where the estimate is shown, not only in the two forms and the RJIP
   * export.
   *
   * A record with no money date is attributed to a year by its document date because nothing else is
   * recorded. That stand-in has no legal footing: for Titlul IV the document date is a validity condition
   * (art. 68 alin. (4) lit. a) „justificate prin documente”), never the fact that decides the year, which
   * is „sumele încasate” (alin. (2) lit. a)) and „al anului în cursul căruia au fost plătite” (alin. (4)
   * lit. b)). No provision presumes document date = money date, and none fills in a blank money date. The
   * behaviour is unchanged — which date to record is the person's decision — but the estimate no longer
   * presents a figure whose year was chosen on paper as if the paper were the payment.
   */
  assumedFromDocument: (n: number): string =>
    n === 1
      ? 'O înregistrare a fost atribuită acestui an fiscal după data documentului, pentru că nu are dată de '
        + 'încasare sau de plată înregistrată. Legea alege anul după banul încasat sau plătit, nu după hârtie '
        + '(art. 68 alin. (2) lit. a) și art. 68 alin. (4) lit. b) din Codul fiscal); nicio dispoziție nu prezumă că '
        + 'data documentului este data banului și nici nu completează o dată de plată lipsă.'
      : `${n} înregistrări au fost atribuite acestui an fiscal după data documentului, pentru că nu au dată de `
        + 'încasare sau de plată înregistrată. Legea alege anul după banul încasat sau plătit, nu după hârtie '
        + '(art. 68 alin. (2) lit. a) și art. 68 alin. (4) lit. b) din Codul fiscal); nicio dispoziție nu prezumă că '
        + 'data documentului este data banului și nici nu completează o dată de plată lipsă.',
} as const;

export const documents = {
  title: 'Documente',
  subtitle: 'Documente de înregistrare, declarații fiscale și rapoarte de trezorerie — stocate local.',
  tabs: {
    pfa: 'Documente PFA',
    declarations: 'Declarații',
    reports: 'Rapoarte',
  },
  uploadManyHint: 'Se pot încărca mai multe documente',
  /**
   * The four registration sections, keyed by the same `DocTypeCode` the data layer uses. The words used
   * to sit in `DOC_SECTIONS` below the data layer, where no language test could reach them.
   */
  sections: {
    im: {
      title: 'Impozit pe venit (IM)',
      // B-62 — D100 is not an „impozit pe venit” declaration. Its official name is „Declarație privind
      // obligațiile de plată la bugetul de stat” (cod 14.13.01.99/bs): the quarterly Titlul III return,
      // owed by a micro-enterprise. A Titlul IV taxpayer never files it, so the caption has to say which
      // form this really is rather than which bucket the file was dropped into.
      desc: 'Declarația 100 — obligații de plată la bugetul de stat (cod 14.13.01.99/bs)',
      helper: 'Un fișier pe perioadă (PDF).',
    },
    cs: {
      title: 'Contribuții sociale (CS)',
      // B-62 — D220 is „Declarație privind venitul estimat / norma de venit”, not a social-contribution
      // document. Naming it „contribuții sociale” sent people to the wrong form for a real contribution
      // document.
      desc: 'Declarația 220 — venitul estimat sau norma de venit',
      helper: 'Un fișier pe perioadă (PDF).',
    },
    tva: {
      title: 'TVA',
      desc: 'Declarația 300 / TVA',
      helper: 'Un fișier pe perioadă (PDF).',
    },
    facturi: {
      title: 'Facturi și documente',
      desc: 'Facturi, note fără factură, bonuri fiscale',
      helper: 'Poți adăuga mai multe fișiere.',
    },
  },
  hideExamples: 'Ascunde exemplele',
  showExamples: 'Vezi exemple',
  uploadOther: 'Încarcă alt document',
  upload: 'Încarcă document',
  preview: 'Previzualizează',
  download: 'Descarcă',
  empty: 'Niciun document încărcat.',
  acceptedFormats: 'Format acceptat: PDF, JPG, PNG',
  /**
   * The limit is stated by the caller from `MAX_DOC_BYTES`, not baked into the sentence. The copy used to
   * say 2 MB while the constant is 5 MB — a number in a message that the code never checked.
   */
  tooLarge: (limitMb: number): string =>
    `Fișierul depășește ${limitMb} MB — stocarea locală nu e suficientă`,
  pdfOnly: 'Doar fișiere PDF',
  maxSizeMb: (limitMb: number): string => `Maxim ${limitMb} MB`,
  uploaded: (name: string): string => `„${name}" a fost încărcat`,
  readFailed: 'Nu am putut citi fișierul',
  deleted: (name: string): string => `„${name}" a fost șters`,
  /**
   * PG-11 (phase 29) — a record that points at document bytes the blob store cannot produce.
   *
   * Named rather than swallowed. Before this phase a document's bytes were always inside the record, so a
   * download could not quietly come back empty; now a pointer can outlive the bytes it points at, and the
   * only honest response is to say so at the moment the person reaches for the file — not months later, on
   * the day they have to produce it.
   */
  bytesUnavailable: (name: string): string =>
    `Nu am putut deschide „${name}”: nu găsim octeții lui în depozitul de documente.`,
  declaration: {
    addTitle: 'Adaugă declarație depusă',
    // One wording for "this field is required": the shared validation keys, not a second spelling.
    typeRequired: validation.declarationTypeRequired,
    periodRequired: validation.periodRequired,
    type: 'Tip declarație *',
    typePlaceholder: 'ex. D101, D112, D200, 220, 221…',
    period: 'Perioadă *',
    periodPlaceholder: 'ex. I–IV 2025, luna martie 2025',
    method: 'Mod de depunere',
    methodSolo: 'Prin SOLO',
    methodPersonal: 'Personală',
    depunereDate: 'Data depunerii',
    pdfLabel: 'Fișier PDF atașat (opțional)',
    changeFile: (name: string): string => `Schimbă: ${name}`,
    choosePdf: 'Alege un PDF',
    emptyTitle: 'Nicio declarație înregistrată',
    emptyBody:
      'Înregistrează aici declarațiile fiscale depuse (D101, D112, 220, 221…) cu perioada și modul de depunere.',
    add: 'Adaugă declarație',
    registered: (tip: string, perioada: string): string =>
      `Declarația ${tip} (${perioada}) a fost înregistrată`,
    deleteTitle: 'Șterge declarația?',
    deleted: 'Declarația a fost ștearsă',
    columns: {
      type: 'Tip',
      period: 'Perioadă',
      method: 'Depunere',
      date: 'Data',
      file: 'Fișier',
    },
  },
  rjip: {
    noCashflow: (year: number): string => `Niciun flux de trezorerie pentru ${year}`,
    generated: (year: number, rows: number): string =>
      `RJIP ${year} a fost generat (${rows} ${rows === 1 ? 'rând' : 'rânduri'})`,
    description:
      'Rapoarte de mișcări de trezorerie (RJIP) — generat din datele din Venituri și Cheltuieli.',
    downloadCsv: '⬇ Descarcă CSV',
    revenue: (year: number): string => `Venituri ${year}`,
    expenses: (year: number): string => `Cheltuieli ${year}`,
    balance: 'Sold',
    rows: 'Rânduri',
    csvHeader: 'Data;Descriere;Venit (RON);Cheltuiala (RON)',
    /**
     * PG-2 (B-66). OMFP 170/2015 cap. V Secțiunea a 2-a makes the register's date column „data
     * efectuării operațiunii de încasare/plată”, and the justificatory document a separate
     * cross-reference column — which is what `Descriere` carries (fel + număr). The sentence names the
     * rule the column follows, so the export never implies the document date is the posting date.
     */
    postedOn:
      'Data din registru este data încasării, respectiv data plății — „data efectuării operațiunii de '
      + 'încasare/plată” (OMFP 170/2015, cap. V). Documentul stă la baza înregistrării și este menționat '
      + 'în coloana Descriere.',
    /**
     * The honest remainder: a record with no money date is posted on its document date because nothing
     * else is recorded. That is stated as what the app did, never as what the law prescribes —
     * research/37 §4.4 found no statutory presumption that fills in a missing money date.
     */
    postedOnDocumentDate: (n: number): string =>
      n === 1
        ? 'O înregistrare a fost postată pe data documentului pentru că nu are dată de încasare sau de '
          + 'plată înregistrată.'
        : `${n} înregistrări au fost postate pe data documentului pentru că nu au dată de încasare sau de plată înregistrată.`,
    /**
     * TASK 10a (B-32). The RJIP is a leu register — its own header says `(RON)`. A record written in euro
     * has no leu amount until a BNR rate is attached to it, so it is left out and said out loud, never
     * exported at its cents figure relabelled as lei.
     */
    foreignCurrencyExcluded: (n: number): string =>
      n === 1
        ? 'O înregistrare este într-o monedă străină și nu intră în RJIP, care se ține în lei.'
        : `${n} înregistrări sunt în monede străine și nu intră în RJIP, care se ține în lei.`,
    invoiceKind: {
      factura: 'Factură',
      nota: 'Notă de factură',
    },
  },
} as const;

export const eFactura = {
  title: 'e-Factura',
  // B-56 — this page described itself as the state of invoices „transmise în sistemul e-Factura”.
  // Nothing is transmitted: there is no client, and `eFacturaStatus` is a value this app stores, not an
  // answer from ANAF. The page now says whose record it is and what it is not.
  subtitle:
    'Starea pe care ai notat-o în aplicație pentru facturile emise. Aplicația nu este conectată la sistemul e-Factura.',
  tabs: {
    accepted: 'Acceptate',
    pending: 'În așteptare',
    rejected: 'Respinse',
  },
  emptyTitle: 'Nicio factură în această stare',
  emptyBody: 'Aici apar facturile emise pentru care ai notat o stare în aplicație.',
  resend: 'Notează o nouă transmitere',
  resentDetail: 'Nouă transmitere notată în aplicație',
  resentToast: (nr: string): string =>
    `${nr} este înregistrată în aplicație ca factură pe care trebuie să o retransmiți`,
  columns: {
    document: 'Document',
    client: 'Client',
    cui: 'CUI',
    date: 'Data',
    total: 'Total',
    status: 'Status e-Factura',
  },
} as const;
