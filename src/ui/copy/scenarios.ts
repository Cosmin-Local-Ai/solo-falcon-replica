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
     *
     * PG-6h-2 widened it, because the gap now has three named causes rather than two: the room count for
     * the year (which decides the *title*, not a figure), the alin. (1) answer, and the reading of
     * alin. (3). It also says plainly that a CAEN code is not how any of them gets filled in — the
     * likeliest affected taxpayer has no CAEN code at all (`research/39` §1), and HG 656/1997 art. 4 alin.
     * (1) says a CAEN classification „nu presupune crearea de drepturi sau obligații”. And it no longer
     * promises that answering produces a figure: the register-level calculation this app runs is still the
     * effective-expense one, and running the flat ratio beside it would measure the same receipts twice.
     * That is stated here rather than discovered by the reader when the answers change nothing.
     */
    accommodationGrossUndetermined:
      'Aplicația știe să calculeze metoda pentru cazare: cheltuieli forfetare de 30 % din venitul brut și impozit de 10 % din venitul net. Ceea ce nu se poate stabili este venitul brut la care s-ar aplica metoda. Trei răspunsuri decid brutul: câte camere închiriezi pe termen scurt în acest an fiscal (câte camere hotărăște sub ce titlu intră venitul, nu cât de mare e o cifră), dacă ești operator economic potrivit legislației turismului, și ce citire a art. 68^3 alin. (3) se aplică. Niciunul nu se completează din codul CAEN și niciunul prin implicit. Ce mai este deschis este mai jos, în cuvintele legii; completarea lor nu aduce încă o cifră, pentru că singurul calcul pe aplicația îl face pe registru este cel al cheltuielilor efective, iar metoda forfetară deasupra lui ar măsura aceleași încasări de două ori.',
    /**
     * PG-6h-2 — the room count puts this income under *cedarea folosinței bunurilor*, not art. 68^3.
     *
     * This is the one sentence in the app that states which TITLE the income falls under, and it has to be
     * exact, because the count is a category switch: art. 83 alin. (2) gives 1–7 camere in a personal
     * dwelling to *cedarea folosinței bunurilor*, art. 85 alin. (1) treats that taxpayer as a category of
     * its own, and art. 83 alin. (4) moves the same person to a activitate independentă only from the
     * fiscal year the count passes 7. The flat-ratio arithmetic in this build belongs to the second title
     * only, so the sentence says which title the app believes it is in, cites the articles, and says what
     * the app does not have for the first one — no art. 85 rule exists in this package, and D-CAZ-1 path
     * (c) is a separate rule with a separate citation, not the same rule under another number.
     */
    accommodationTitleCedareaFolosintei:
      'Numărul de camere înregistrat pentru acest an fiscal este între 1 și 7, iar legea pune venitul acesta sub un alt titlu decât activitatea independentă: art. 83 alin. (2) din Codul fiscal îl dă în cedarea folosinței bunurilor, iar art. 85 alin. (1) îl tratează ca categorie de sine stătătoare. Trecerea la art. 68^3 se face abia din anul fiscal în care numărul camerelor este peste 7 — art. 83 alin. (4). Metoda forfetară pe care aplicația o calculează aparține celuilalt titlu, iar o regulă pentru art. 85 nu există în acest pachet de reguli, așa că aplicația refuză o cifră în loc să aplice unor venituri din închiriere regulile altei categorii.',
    /**
     * PG-6h-2b — the register's receipts cannot be attributed to a determination method (B-85).
     *
     * This sentence has one job: to name what is missing without pretending the app could supply it. It
     * must not say the law forbids mixing the two methods — art. 68^3 alin. (11) contemplates exactly that
     * taxpayer — and it must not say the activity can never be calculated, which D-CAZ-1 already decided
     * against. What it says is that the app holds one register of receipts and no record of which activity
     * each receipt came from, and that choosing the split would be the app's guess, not the person's.
     *
     * It also has to be plainly different from the sentence above it. That one says the gross is not
     * settled because three questions are unanswered, and answering them is the person's act. This one says
     * that even a settled gross would not be enough, because the app cannot tell which receipts the method
     * applies to. One is a missing answer; the other is a missing fact the app has never asked for.
     */
    accommodationAttributionMissing:
      'Aplicația nu poate stabili care dintre încasările acestui registru sunt veniturile la care se aplică metoda forfetară. Înregistrările de venit nu păstrează activitatea din care a venit fiecare încasare, așa că aplicația nu poate împărți registrul între metoda forfetară și sistem real fără să ghicească ea. O astfel de împărțire ar muta venituri de la un titlu fiscal la altul dintr-o presupunere a aplicației, nu dintr-un răspuns al tău, așa că aplicația refuză o cifră în loc să atribuie ea încasările.',
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
