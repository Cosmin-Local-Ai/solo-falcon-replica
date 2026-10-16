/**
 * Persona 6 — **passive investor** (no CAEN: a dividend recipient is not a PFA and has no obiect de
 * activitate).
 *
 * ## What this person is
 *
 * A salaried employee whose other income is capital: dividends from two companies, bank interest, an
 * *asociere cu o persoană juridică* contract, copyright royalties received as a private person, and one
 * apartment let to a **company**. There is no business, so there is no CAEN code — and that has to stay
 * visible, because it is the case that proves a CAEN→persona mapping must tolerate „no CAEN".
 *
 * ## Why this persona carries the DPI *contribution* path
 *
 * Persona 2 records DPI receipts in the register, which the engine scopes out and reports as a coverage
 * gap. This persona instead **declares** the DPI net on the art. 170 alin. (4) ladder — the same quantity,
 * arriving by the other of the two routes `dpiDoubleRepresentation` exists to keep apart. Declaring it is
 * what makes the contribution arithmetic visible:
 *
 * - **CAS art. 137 alin. (1) lit. b¹)** joins the art. 148 alin. (3) cumulation — the B-112 defect was
 *   exactly that this limb was missing;
 * - **CAS reținută la sursă** (art. 151 alin. (5)-(11)) is computed on the **DPI source net alone**, not on
 *   the cumulation, because the payer's withholding follows the rung its own source selects;
 * - **CASS art. 155 alin. (1) lit. c)** enters the ladder, and **CASS reținută la sursă**
 *   (art. 174¹ alin. (3)-(6)) is deducted from the contribution due rather than added to it.
 *
 * ## The salariat case, stated as unresolved
 *
 * art. 150 alin. (2) exempts a salary earner from CAS **only** for art. 137 alin. (1) lit. b¹) income, and
 * whether it also bears on the ceiling test is genuinely unresolved (`research/52` §Q2). This persona shows
 * CAS = 0 — the cumulated net sits below the 12-smn floor — and asserts nothing about which rung a salary
 * would have named. Brief 64 Part D item 5 asks for exactly that restraint.
 *
 * ## art. 84¹, the other half of the rent pair
 *
 * The tenant here is an entity with accounting records, so the year runs **art. 84¹**: the gross is what the
 * tenant **paid**, converted at the day before each payment, the tax is withheld at source and final, and
 * the landlord owes no Declarația Unică for the income tax (art. 122 alin. (6) lit. a)) while still owing
 * one for the contributions. Persona 5 is the art. 84 half of the same pair.
 *
 * ## Why this persona holds no carried-in loss (brief 77)
 *
 * Brief 77 suggested persona 6 for `profile.priorYearFiscalLosses`. Measured, it cannot carry one: with a
 * 30.000-lei loss declared here — `activitate_independenta` **or** `drepturi_proprietate_intelectuala`, year
 * 2022 — the estimate returns **no art. 118 row at all** and the 9.720,00 RON figure does not move. The
 * composition that applies art. 118 alin. (2) lit. a) sits on the sistem-real path, and this register never
 * reaches it: its only register income is art. 84¹ rent under a flat ratio, and its DPI net arrives on the
 * art. 170 alin. (4) ladder. A loss declared here would be a fact the app is told about and then says
 * nothing about — the exact shape brief 77 refuses. The fact lives on persona 8 instead, whose cash-basis
 * mechanism is what produces a fiscal loss in the first place.
 *
 * **The silence is itself worth recording**: a declared loss on a flat-ratio register is neither applied nor
 * refused. Nothing on screen says "this loss could not be used, and here is why". That is a finding for a
 * later brief, not something a persona may paper over.
 *
 * ## B-122 stays visible
 *
 * arendă and asocieri are withholding sources under art. 174¹ alin. (3) and the engine does not model them.
 * This persona holds both, so it is the persona that lands on the gap; the coverage test records that it
 * lands there rather than pretending otherwise.
 */
import { lei } from '../../domain/money';
import type { PersonaDefinition } from './personaTypes';
import {
  caenClass,
  invoices,
  ladderYear,
  personaDataset,
  personaProfile,
  type PartySpec,
} from './personaKit';

const IDENTITY = {
  nume: 'Odăgescu Elena-Carmen',
  cnp: '2770000401213',
  adresa: 'Str. Griviței 19, Oradea',
  telefon: '0755 660 302',
  email: 'elena@odegescuinvestitii.example',
  denumire: 'Odăgescu Elena-Carmen',
  cui: 'RO23456781',
  formaJuridica: 'Persoană fizică (fără activitate autorizată)',
  numarRegComert: '',
  contBancar: 'RO44 CARP 0000 0000 1122 3344 9006',
  banca: 'Banca Carpatică',
};

const EMPLOYER: PartySpec = {
  id: 'p6-employer',
  denumire: 'Industrială Carpatică SRL',
  cui: 'RO57913681',
  email: 'resurse-umane@industrialacarpatica.example',
  oras: 'Oradea',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'salariu lunar; statul de plată atestă venitul de la art. 60',
};

const DIVIDEND_PAYER: PartySpec = {
  id: 'p6-dividend',
  denumire: 'Carpatica Invest SRL',
  cui: 'RO68024793',
  email: 'financiar@carpaticainvest.example',
  oras: 'Cluj-Napoca',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'dividende distribuite în aprilie; impozit pe dividende reținut de societate',
};

const ASSOCIATE: PartySpec = {
  id: 'p6-asociere',
  denumire: 'Ferma Someșului SRL',
  cui: 'RO35791468',
  email: 'asociere@fermasomesului.example',
  oras: 'Zalău',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'contract de asociere cu o persoană juridică; venit distribuit la închiderea exercițiului',
};

const ROYALTY_PAYER: PartySpec = {
  id: 'p6-royalty',
  denumire: 'Editura Văcărești SRL',
  cui: 'RO69471583',
  email: 'drepturi@vacarestieditura.example',
  oras: 'București',
  tara: 'România',
  kind: 'platform_withholding',
  cadenta: 'drepturi de autor, statament semestrial; CAS și CASS reținute la sursă',
};

const CORPORATE_TENANT: PartySpec = {
  id: 'p6-tenant',
  denumire: 'Depozitele Someșeni SRL',
  cui: 'RO24680358',
  email: 'administrativ@somisenidepozite.example',
  oras: 'Oradea',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'chirie lunară cu reținere și virare la sursă (art. 84^1 alin. (4))',
};

const profile = personaProfile('persona-passive-investor', IDENTITY, [
  // No CAEN class: this person has no registered business activity. `caenClass('')` is not called, and the
  // empty list is the honest state — see the header.
], {
  pfaStartYear: 2014,
  pfaStartDate: '2014-01-06',
  activityFamily: 'other',
  // The salariat fact. art. 150 alin. (2) reaches only art. 137 alin. (1) lit. b^1), so this does not by
  // itself switch CAS off, and the app does not treat it as if it did.
  salaryStatus: 'da',
  salaryIncomeLei: lei(96000),
  // The tenant's legal nature is what selects art. 84^1 over art. 84.
  leaseFactsYears: [
    {
      fiscalYear: 2026,
      tenantNature: 'entitate_cu_evidenta_contabila',
      contractDate: '2025-09-01',
      contractRegistered: 'da',
      rentPaidExclusivelyInKind: 'nu',
      guaranteeAppliedToRent: 'nu',
    },
  ],
  // The six art. 155 alin. (1) lit. c)-h) categories, each as the figure art. 170 alin. (4) actually
  // measures — net for c), d), e), g), brut for h) — plus the CASS the payers already withheld.
  cassLadderYears: [
    ladderYear({
      fiscalYear: 2026,
      proprietateIntelectuala: lei(30000),
      asocierePersoanaJuridica: lei(40000),
      activitatiAgricole: lei(0),
      activitatiAgricoleBaza: 'venit_net',
      investitii: lei(252000),
      investitiiBaza: 'dividende_platite_diminuate_cu_impozitul_retinut',
      alteSurse: lei(12000),
      alteSurseArt114: 'da',
      // No `cassRetinutLaSursa` declared. art. 154 alin. (1) lit. h^1) makes a salary earner not owe CASS
      // for DPI income, so the payer has nothing to retain on that category and a declared withheld amount
      // would be a fact the engine is entitled to contradict. The exemption is what the app states instead.
    }),
  ],
  vatRegistration: { status: 'scutit_art310' },
});

export const passiveInvestorPersona: PersonaDefinition = {
  id: 'passive-investor',
  label: 'Investitor pasiv, salariat',
  summary:
    'Salariat cu dividende, dobânzi, un contract de asociere cu o societate, drepturi de autor și un '
    + 'apartament închiriat unei firme. Fără PFA, fără cod CAEN.',
  teaches: [
    'Dividendele ca bază CASS: „dividendele plătite, diminuate cu impozitul reținut” — măsura se ia la art. 170 alin. (4) lit. d) (veniturile din investiții), iar categoria este art. 155 alin. (1) lit. g): „venituri din investiții, definite conform art. 91”. Citatul este cel care decide; litera doar arată unde te uiți (research/41 §2, research/48 §5)',
    'Scara CASS pe art. 155 alin. (1) lit. c), d), g) și h) — trei litere intrate de o singură persoană',
    'CAS și CASS reținute la sursă (art. 151 alin. (5)-(11), art. 174^1 alin. (3)-(6)) și diferența de plătit',
    'art. 84^1: chiriei plătite de o entitate cu evidență contabilă, cu impozit reținut și final',
    'Cazul salariatului: art. 150 alin. (2) atinge doar lit. b^1), iar aplicația nu susține că a rezolvat testul de plafon',
  ],
  identity: IDENTITY,
  // No CAEN. A dividend recipient is not a PFA and has no obiect de activitate; this is the case a
  // CAEN→persona mapping must answer with „no code", not with a guess.
  caen: { principal: '', secondary: [] },
  counterparties: [
    { name: EMPLOYER.denumire, kind: EMPLOYER.kind, tara: EMPLOYER.tara, cadenta: EMPLOYER.cadenta },
    { name: DIVIDEND_PAYER.denumire, kind: DIVIDEND_PAYER.kind, tara: DIVIDEND_PAYER.tara, cadenta: DIVIDEND_PAYER.cadenta },
    { name: ASSOCIATE.denumire, kind: ASSOCIATE.kind, tara: ASSOCIATE.tara, cadenta: ASSOCIATE.cadenta },
    { name: ROYALTY_PAYER.denumire, kind: ROYALTY_PAYER.kind, tara: ROYALTY_PAYER.tara, cadenta: ROYALTY_PAYER.cadenta },
    { name: CORPORATE_TENANT.denumire, kind: CORPORATE_TENANT.kind, tara: CORPORATE_TENANT.tara, cadenta: CORPORATE_TENANT.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: invoices(Array.from({ length: 12 }, (_, i) => [i + 1, 10, 6000] as const), {
      party: CORPORATE_TENANT, prefix: 'CHIR-P6', vat: false,
    }),
    expenses: [],
    clients: [EMPLOYER, DIVIDEND_PAYER, ASSOCIATE, ROYALTY_PAYER, CORPORATE_TENANT],
  }),
};
