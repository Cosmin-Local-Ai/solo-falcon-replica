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
    noExpenseEngine:
      'Pentru această activitate legea nu lasă o bază pe cheltuieli înregistrate, iar aplicația nu are cum să calculeze. Refuză un rezultat în loc să inventeze unul.',
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
