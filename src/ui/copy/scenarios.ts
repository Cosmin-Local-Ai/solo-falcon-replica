/**
 * PG-6a — the sentences the scenario-support registry speaks.
 *
 * The registry in `domain/scenarios.ts` carries a `ScenarioMessageKey` and never a sentence; this file
 * carries the sentences and never decides which scenario fired. That split is the whole reason the
 * registry's `message` field is a key: a domain module that could put words on screen is a domain
 * module that could state a legal conclusion the language layer never agreed to.
 *
 * What these sentences may claim, and what they may not:
 *
 * - A refusal says the app **cannot** compute. It never says the taxpayer owes nothing, and it never
 *   paraphrases the rule — the rule's own sentence is rendered beside these words, verbatim, from the
 *   layer that wrote it.
 * - The framing sentence is about this app's capability („acest pachet de reguli”), not about the law's
 *   content. `research/26` §10.3 leaves the status of the Norme metodologice unverified, and a copy
 *   file is not where that gap gets papered over.
 */
import type { ScenarioMessageKey } from '../../domain/scenarios';

export const scenarios = {
  /**
   * One framing sentence per registered scenario, keyed by the registry's own key so a new scenario
   * without a sentence is a compile error here rather than a raw token on screen.
   */
  messages: {
    /**
     * The art. 68^3 accommodation case. D-CAZ-1 (`docs/ai/USER_DECISIONS.md`) decided this regime is
     * supported, not permanently refused, and PG-6h builds it — so the sentence says the app does not
     * implement the method **yet**, never that the activity cannot be calculated. It still refuses, because
     * today the only calculation this build has is the effective-expense one, and applying it to
     * accommodation income would produce a figure under rules that are not that taxpayer's.
     */
    noExpenseEngine:
      'Pentru această activitate legea a ales o altă metodă de calcul, pe o cotă forfetară de cheltuieli, iar aplicația încă nu implementează metoda aceasta. Refuză un rezultat în loc să aplice asupra venitului tău regulile unei alte activități.',
    regimeNotComputable:
      'Regimul fiscal din profil nu este unul pe care acest pachet de reguli să îl poată calcula. Aplicația refuză un rezultat în loc să inventeze unul.',
    /**
     * PG-6b — the profile has not declared its activity family.
     *
     * This sentence frames a gap, it does not announce one: the figure stays on screen because the app can
     * still produce it from the records it holds, and what is missing is the fact that decides whether the
     * rules used are the right ones. It therefore says what was not asked, what the figure assumes, and
     * that the app will not guess from a CAEN code — `research/30` §3 records that OMFP 925/2017 art. 2
     * alin. (4) keys the determination method to the activity description „independent de codurile CAEN
     * menționate cu titlu exemplificativ”, so a code is not evidence about how the law taxes this person.
     */
    activityFamilyUndeclared:
      'Profilul nu declară ce activitate desfășori, iar aplicația nu ghicește acest lucru din codul CAEN. Cifra de mai jos este calculată pe regulile de cheltuieli efective (sistem real); dacă activitatea ta se impune prin altă metodă legală, cifra nu este a ta.',
    /**
     * PG-6h-1 — the art. 68^3 method is implemented, and the gross it would run on is not settled.
     *
     * This sentence must not read like the one above it. `noExpenseEngine` says the app lacks the method;
     * that was true until this task and is no longer. What is missing is the input, and the reason is that
     * the law leaves two readings of art. 68^3 alin. (3) on the table and puts the alin. (1) gate outside
     * the fiscal code. So the sentence says the calculation exists, says the gross is what is missing, and
     * points down at the two readings, which are the rule's own words lifted from
     * `ACCOMMODATION_68X3_2026` and rendered directly below this one. It does not restate what those
     * readings cost — the rule text already says that choosing moves the tax, the CASS base and the CAS
     * threshold, and saying it twice in one block is the duplication this codebase treats as a defect.
     */
    accommodationGrossUndetermined:
      'Aplicația știe să calculeze metoda pentru cazare: cheltuieli forfetare de 30 % din venitul brut și impozit de 10 % din venitul net. Ceea ce nu se poate stabili este venitul brut la care se aplică metoda, pentru că legea lasă deschise două întrebări: ce se cuprinde în brut, și cine este operator economic în domeniul turismului. Ambele sunt mai jos, în cuvintele legii; aplicația nu alege în locul tău.',
  } satisfies Record<ScenarioMessageKey, string>,

  /** The control the scenario points at. */
  open: 'Deschide',

  /**
   * The label over the register date when no calculation was made. „Măsurat la” belongs to a figure;
   * when the estimate was refused there is nothing that was measured, and the honest sentence names the
   * reading of the register instead.
   */
  registerReadAsOf: (asOf: string): string => `Registru citit la ${asOf}`,
} as const;
