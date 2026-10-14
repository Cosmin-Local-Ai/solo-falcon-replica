import type { FiscalRule } from './rules';

/**
 * B-112 STAGE 1 — the FY2026 *drepturi de proprietate intelectuală* rules: the art. 72 / art. 72¹ flat
 * quota, the art. 73 actual-expense election, and the art. 72 alin. (3) exclusion set.
 *
 * **Why a new `taxRegime` string rather than a reuse.** `tax.ts` resolves a regime with
 * `applicable.find((r) => r.taxRegime === ...)`, so a second rule sharing `'cas'`, `'cass'`,
 * `'income-tax'` or any of the flat-ratio strings would be silently shadowed by whichever `ruleId` sorts
 * first. DPI shares a **rate** with three other regimes — 10 %, the same as art. 68^3 alin. (6), art. 85
 * alin. (6) and art. 84^1 alin. (5) — and shares nothing else about them:
 *
 * | | quota | gross measured by | who computes the tax | contribution basin |
 * |---|---|---|---|---|
 * | art. 72 / 72¹ (DPI) | **40 %** | the sum the payer owes the author | the **payer**, withheld at payment, final | CAS lit. b¹) + CASS lit. c) |
 * | art. 84 / 84¹ (cedare) | 20 % | contract rent / sum paid per payment | payer (84¹, final) or owner (84) | CASS lit. e) only, no CAS |
 * | art. 85 (1–7 camere) | 30 % | sums încasate, commission outside gross | the owner | CASS lit. e) only, no CAS |
 * | art. 68^3 (cazare) | 30 % | the tourism register's încasări | the owner | CAS + CASS lit. b) |
 *
 * **The 40 % is the number this file exists to get right.** Art. 72 alin. (2) and art. 72¹ alin. (1) both
 * read *„prin deducerea din venitul brut a cheltuielilor determinate prin aplicarea cotei forfetare de 40 %
 * asupra venitului brut”*, so venitul net = **0,6 × venitul brut**. The **20 %** quota belongs to
 * *cedarea folosinței bunurilor* — art. 84 alin. (2) and art. 84¹ alin. (3), introduced by OUG 115/2023 —
 * and is already carried on `CEDARE_ART84_2026` / `CEDARE_ART84X1_2026`. Confusing the two was an explicit
 * premise error recorded in `docs/ai/research/48_dpi_income_rules_fy2026.md` correction 1; the two rule
 * sets sit in different files with different `taxRegime` strings precisely so the numbers cannot be
 * borrowed across.
 *
 * **What is NOT a parameter here, and why.** The CAS and CASS figures DPI triggers stay owned by `CAS_2026`
 * and `CASS_2026` — the same discipline PG-6h-1 states for art. 68^3 („the contribution figures stay owned
 * by CAS_2026 and CASS_2026”). DPI enters the CAS ceiling test of art. 148 alin. (3) as an amount that
 * *selects* the 12/24-SMN tier, and the art. 170 alin. (2)-(4) ladder as a cumulated amount whose *rung*
 * is the base. Neither is a DPI-specific rate, and duplicating 48.600 or 97.200 here would be the drift
 * this package's own history records (Phase 5 deleted `multiple_6x`…`multiple_72x` for exactly that reason).
 */
export const DPI_RULES_2026: FiscalRule[] = [
  {
    jurisdiction: 'RO',
    entityType: 'PFA',
    taxYear: 2026,
    verifiedAt: '2026-10-14',
    status: 'ACTIVE',
    version: 1,
    ruleId: 'DPI_ART72_2026',
    name: 'DPI 2026 — cota forfetară 40 % (art. 72 / art. 72¹) și opțiunea art. 73',
    taxRegime: 'dpi-flat-quota',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      {
        id: 'expense_ratio',
        label: 'Cota forfetară de cheltuieli — 40 % din venitul brut',
        value: 40,
        unit: 'percent',
        description:
          'art. 72 alin. (2) și art. 72¹ alin. (1): „prin deducerea din venitul brut a cheltuielilor ' +
          'determinate prin aplicarea cotei forfetare de 40% asupra venitului brut”. Venit net = 0,6 × brut. ' +
          'NU este cota de 20% — aceea aparține cedării folosinței bunurilor (art. 84 alin. (2) și art. 84^1 ' +
          'alin. (3), introduse prin OUG 115/2023) și sunt reguli separate în acest pachet. Cota se aplică ' +
          'automat, nu la opțiune.',
      },
      {
        id: 'tax_rate',
        label: 'Cota de impozit pe venit — 10 % din venitul net, impozit final',
        value: 10,
        unit: 'percent',
        description:
          'art. 72 alin. (1) și alin. (4): cota de 10% se aplică asupra venitului net, „impozitul fiind final”. ' +
          'Povara efectivă este 6% din brut (10% × 60%). Art. 72 alin. (5): venitul net și impozit sunt ' +
          'stabilite și reținute la sursă de plătitorul de venit, la momentul plății.',
      },
      {
        id: 'excluded_kinds',
        label: 'Setul de excluzere de la cota forfetară — art. 72 alin. (3) / art. 72¹ alin. (2)',
        value: 'mostenitori;drept_de_suita;remuneratie_copia_privata',
        unit: 'text',
        description:
          'Același set are DOUĂ consecințe, citite dintr-un singur predicate în domain/dpi.ts ' +
          '(isDpiArt72Alin3Excluded): (1) nu primește cota forfetară de 40% — art. 72 alin. (3) și art. 72^1 ' +
          'alin. (2); (2) este exclus de la CAS — art. 137 alin. (1) lit. b^1) „cu excepția veniturilor ' +
          'prevăzute la art. 72 alin. (3)”. Modelat o singură dată, nu de două ori.',
      },
      {
        id: 'contributions_inside_quota',
        label: 'Contribuțiile sociale sunt înăuntrul cotei forfetare',
        value:
          'ANAF DGRFP Cluj, 12 februarie 2026: „În cheltuielile forfetare se includ, printre altele: ' +
          'contribuțiile sociale datorate, comisioanele, sume care revin organismelor de gestiune colectivă…”. ' +
          'CAS și CASS plătite de autor sunt deci înăuntrul celor 40% și NU se scad încă o dată din baza de ' +
          'impozit pe venit a venitului din DPI.',
        unit: 'text',
        description:
          'Consecință practică: deducerea CAS/CASS de la art. 118 alin. (2^2)-(2^3) privește baza în sistem ' +
          'real, nu venitul net DPI determinat prin cotă forfetară. A scădea contribuțiile și din forfetar ' +
          'și din baza impozabilă ar deduce aceeași sumă de două ori.',
      },
      {
        id: 'election_binding_years',
        label: 'Opțiunea pentru cheltuieli reale (art. 73) — obligatorie pentru 2 ani fiscali consecutivi',
        value: 2,
        unit: 'count',
        description:
          'art. 73 alin. (1)-(3): „Contribuabilii … au dreptul să opteze pentru determinarea venitului net în ' +
          'sistem real, potrivit art. 68”, exercitată prin Declarația Unică, obligatorie pentru 2 ani fiscali ' +
          'consecutivi și reînnoită automat. art. 73 alin. (4): „Obligațiile declarative și regulile de ' +
          'impunere sunt cele stabilite pentru veniturile nete anuale din activități independente determinate ' +
          'în sistem real.” Fapta alegerii este a persoanei; acest parametru spune cât ține, nu cine a ales.',
      },
      {
        id: 'withholding_deadline',
        label: 'Termenul de virare de către plătitorul de venit',
        value: 'până la data de 25 inclusiv a lunii următoare celei în care s-a plătit venitul',
        unit: 'text',
        description:
          'art. 72 alin. (5). Este termenul PLĂTITORULUI, lunar — nu termenul contribuabilului, care este ' +
          'cel de la art. 122 alin. (3) pentru contribuții. Row numbers din D212 nu sunt codate aici: ' +
          'sunt specifice unei versiuni de formular, iar formularul FY2026 nu există încă ' +
          '(research/48 §8 și §11.2).',
      },
      {
        id: 'no_withholding_cases',
        label: 'Când plătitorul nu reține — art. 72 alin. (6)',
        value:
          'art. 72 alin. (6): plătitorul nu are obligația reținerii pentru asocierile fără personalitate ' +
          'juridică și pentru entitățile care ține evidență contabilă. În lipsa reținerii, contribuabilul își ' +
          'stabilește singur impozitul de 10% asupra venitului net — art. 123 alin. (2).',
        unit: 'text',
        description:
          'Aceeași cotă, același net; se schimbă a cui obligație este suma și dacă ajunge la buget prin ' +
          'plătitor sau prin Declarația Unică. Art. 72 alin. (7): veniturile din DPI nu impun Registrul ' +
          'de evidență fiscală și nici evidență contabilă.',
      },
      {
        id: 'cas_limb',
        label: 'Categorii de contribuții pentru același venit — lit. b^1) la CAS, lit. c) la CASS',
        value:
          'CAS: art. 137 alin. (1) lit. b^1) — „venituri din drepturi de proprietate intelectuală, definite la ' +
          'art. 70, cu excepția veniturilor prevăzute la art. 72 alin. (3)”. CASS: art. 155 alin. (1) lit. c) ' +
          '— „venituri din drepturi de proprietate intelectuale, definite conform art. 70”. Același venit, ' +
          'două litere diferite; cele două căi CASS (alin. (1) cu net real și alin. (2)-(5) cu treapta) nu se ' +
          'cumulează niciodată între ele — ANAF DGRFP Cluj, 22 aprilie 2026: „Veniturile din activități ' +
          'independente nu se cumulează cu alte venituri pentru determinarea obligației de plată a CASS.”',
        unit: 'text',
        description:
          'Parametru descriptiv, nu valoare de calcul. Cuantumele CAS/CASS rămân deținute de CAS_2026 și ' +
          'CASS_2026; DPI intră în testul de plafon de la art. 148 alin. (3) ca sumă care ALEGE treapta, și ' +
          'în scara de la art. 170 alin. (2)-(4) ca sumă cumulată a cărei TREAPTE este baza.',
      },
    ],
    calculatorId: 'calc-dpi-flat-quota',
    sourceAct: 'Cod fiscal — art. 70, art. 72, art. 72^1, art. 73 (consolidare cu Legea 141/2025)',
    sourceArticle:
      'art. 70 (definirea veniturilor din DPI); art. 72 alin. (1)-(2) (10% și cota forfetară de 40%); ' +
      'art. 72 alin. (3) (setul fără cotă forfetară, exclus și de la CAS prin art. 137 alin. (1) lit. b^1)); ' +
      'art. 72 alin. (4)-(5) (reținere la sursă, impozit final, termen 25); art. 72 alin. (6)-(7) (fără ' +
      'reținere; fără registru sau evidență contabilă); art. 72^1 alin. (1)-(2) (același forfetar de 40% ' +
      'când plătitorul nu este entitate cu evidență contabilă); art. 73 alin. (1)-(4) (opțiunea pentru ' +
      'cheltuieli reale, obligatorie 2 ani fiscali consecutivi); art. 123 alin. (2) (impozit stabilit de ' +
      'contribuabil în lipsa reținerii)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/312601',
  },
];

/**
 * The rule ids this file adds, exported so a reader can see the DPI surface without diffing the package.
 * The package itself is assembled in `./release2026dpi`, because a release — not a file — is the unit the
 * registry content-addresses.
 */
export const DPI_RULE_IDS_2026: string[] = DPI_RULES_2026.map((r) => r.ruleId);

/**
 * The art. 72 alin. (3) exclusion set as the rule states it, read back as data.
 *
 * `domain/dpi.ts` owns the token list the record stores; this reads the rule's own copy so a surface can
 * show *the rule's* words beside the flag rather than a paraphrase. It is not a second decision point: the
 * predicate that decides anything is `isDpiArt72Alin3Excluded`, and it keys on the stored flag.
 */export function dpiExcludedKindsOf(rules: readonly FiscalRule[], taxYear: number): string[] {
  const rule = rules.find((r) => r.ruleId === 'DPI_ART72_2026' && r.taxYear === taxYear);
  const value = rule?.parameters.find((p) => p.id === 'excluded_kinds')?.value;
  return typeof value === 'string' ? value.split(';').filter(Boolean) : [];
}

/**
 * The lei figure the DPI rule's own quota leaves from a gross — exported for the coverage row that has to
 * tell a person what was withheld from their DPI receipts. It reads the rule; it does not restate it.
 */
export function dpiQuotaPercentOf(rules: readonly FiscalRule[], taxYear: number): number | null {
  const rule = rules.find((r) => r.ruleId === 'DPI_ART72_2026' && r.taxYear === taxYear);
  const p = rule?.parameters.find((x) => x.id === 'expense_ratio');
  return p && typeof p.value === 'number' ? p.value : null;
}
