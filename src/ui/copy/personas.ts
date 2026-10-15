/**
 * Step 11 / Part D (B-132) — the words on the persona surface.
 *
 * ## Why the match level gets a sentence per level, not one sentence and a colour
 *
 * Part B shipped a lineage walk, and the measured consequence is that most routed clase match on bare
 * secțiune ancestry — the coarsest key in the nomenclator, and the one B-136 shows is contested between two
 * official sources. A secțiune-level route therefore must not read like a clasă-level one.
 *
 * `levelSentence` is a record keyed by the level rather than one template with the level interpolated into
 * it, because a template would give every level the same sentence shape and let a colour carry the
 * difference. Here the difference is in the words, so it survives a screen reader, a high-contrast theme,
 * and a test that asserts on rendered text.
 *
 * ## What these sentences are not allowed to claim
 *
 * No confidence percentage, no „potrivire 70 %": the app has no basis for such a number, and inventing one
 * would be the same class of defect as a generic threshold label standing in for a real one. The strength of
 * a route is stated as *which lineage level matched* — a fact printed in MO 385 — and as nothing else.
 *
 * The level words themselves are NOT spelled here. `CAEN_MATCH_LEVEL_LABELS` in `src/data/personas/index.ts`
 * already builds them from `CAEN_LEVEL_LABELS`, and the surface renders those: a second spelling of
 * „diviziune" is how a rename ends up half-applied.
 */
import type { CaenMatchLevel } from '../../data/personas';

export const personas = {
  introTitle: 'Ce demonstrație vi se potrivește',
  /** The page header's one line: what the page computes, not what it sells. */
  pageSub: 'Rutare cod CAEN → profil demonstrativ, cu nivelul la care s-a potrivit.',
  declaredTitle: 'Codurile pe care le-ați declarat',
  introBody:
    'Aplicația are profile demonstrative cu înregistrări complete, ca să puteți vedea ce face cu niște '
    + 'numere reale. Nu alegeți o imagine dintr-o galerie: vi se arată ce decide codul CAEN pe care l-ați '
    + 'declarat, și cât de strâns este legat de el.',

  /**
   * The one place the strength of a route is stated. Keyed by level, so a secțiune route cannot be rendered
   * with a clasă route's authority. Each value is a different sentence, not one sentence with the level
   * filled in.
   */
  levelSentence: {
    clasa: 'Persona demonstrativă recomandată — declară exact acest cod CAEN.',
    grupa: 'Apropiată doar la nivel de grupă — niciun persona nu declară acest cod, dar unul declară o '
      + 'clasă din aceeași grupă.',
    diviziune: 'Apropiată doar la nivel de diviziune — niciun persona nu declară acest cod, dar unul '
      + 'declară o clasă din aceeași diviziune.',
    sectiune: 'Apropiată doar la nivel de secțiune — cel mai slab nivel pe care nomenclatorul îl poate '
      + 'susține. Nicio asemănare de activitate mai multă nu este susținută de date.',
    none: 'Fără potrivire — linia clasă → grupă → diviziune → secțiune nu duce la niciun persona.',
  } as const satisfies Record<CaenMatchLevel, string>,

  /** What matched, named: a clasă code, a grupă, a diviziune, a secțiune letter. */
  matchedOnLine: (levelLabel: string, matchedOn: string): string =>
    `Ce s-a potrivit: ${levelLabel} ${matchedOn}.`,
  /** The official class text beside the code, so the user recognises their own activity. */
  denumireLine: (denumire: string): string => `Denumire oficială: ${denumire}.`,
  reasonHeading: 'De ce',
  /** The tie heading, which repeats the route's own note so the list is visibly deliberate. */
  tieHeading: (n: number): string => `${n} personas se potrivesc la acest nivel`,
  candidateRole: {
    principal: 'cod CAEN principal',
    secundar: 'cod CAEN secundar',
  } as const,
  loadDemo: 'Încarcă datele demonstrative',
  exitDemo: 'Revino la datele mele',
  demoOnScreen: 'Acesta este profilul demonstrativ încărcat acum',
  /**
   * B-134 — the persistent marker in the topbar. It lives here rather than in `shell` because the exit
   * control's sentence already lives here, and the same words spelled in two copy modules is the defect the
   * copy guard's last test exists to catch.
   */
  badgeTitle: 'Profil demonstrativ',
  badgeSeed: 'Sandbox de exemplu',
  checkTitle: 'Verifică un alt cod CAEN',
  checkBody:
    'Introduceți un cod din nomenclator ca să vedeți ce profil demonstrativ i-ar corespunde și la ce nivel '
    + 's-ar potrivi. Nu schimbă nimic din ce ați declarat dumneavoastră.',
  checkPlaceholder: 'Cod CAEN, de exemplu 5520',
  checkButton: 'Verifică',
  checkInvalid: (problem: string): string => `Codul nu poate fi verificat: ${problem}`,
  noCaenTitle: 'Nu ați declarat niciun cod CAEN',
  noCaenBody:
    'Rutarea se face din codurile pe care le-ați declarat în Setări → Regim fiscal. Puteți verifica oricum '
    + 'un cod mai jos, înainte să-l declarați.',

  /**
   * The measured distribution, shown rather than asserted. Computed by `caenCoverage()`, so the number on
   * screen is the number the shipped nomenclator supports today, not a figure typed into a file.
   */
  coverageLine: (sectiune: number, routed: number, total: number): string =>
    `Din ${total} clase din nomenclator, ${routed} primesc un profil demonstrativ prin linie, iar `
    + `${sectiune} se potrivesc doar la nivel de secțiune — cel mai slab nivel.`,

  toasts: {
    loaded: (label: string): string =>
      `Încărcate datele demonstrative: ${label}. Nu sunt datele dumneavoastră.`,
    unloaded: 'V-ați întors la datele dumneavoastră. Cifrele demonstrative au dispărut de pe ecran.',
  },
} as const;
