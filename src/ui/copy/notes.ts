/**
 * TASK 7 — the „Notă de interpretare" sentences and the statute text kept behind the sources
 * disclosure.
 *
 * One shape everywhere: the label, then **one plain sentence** naming what the law does not settle
 * and what the app does about it. Rendered by `src/components/ui/InterpretationNote.tsx`, so no site
 * invents its own wording. A note explains an uncertainty; it never resolves one. If a note here
 * would make a withheld conclusion read as decided, the note is wrong — not the conclusion.
 *
 * The `sources` block is the Cod fiscal text itself. It stays reachable — behind „Surse și note de
 * interpretare" — with its citation, but it is no longer printed in the middle of a form.
 */

export const notes = {
  /** A row whose applicability the profile does not settle (any of the `unknown` branches). */
  applicabilityUndecided:
    'Legea condiționează pragul de o faptă pe care aplicația nu o înregistrează, așa că nu decide dacă pragul se aplică și marchează linia ca fiind de verificat.',
  /** art. 68 alin. (6) — which base the annual caps are measured on (TASK 2d). */
  capReading:
    'Legea nu stabilește care interpretare se aplică — nicio normă nu prescrie o ordine — așa că aplicația aplică interpretarea mai puțin generoasă și afișează și cealaltă cifră.',
  /** A legal ceiling the app cannot measure: the datum is missing, not the rule. */
  capUnmeasurable:
    'Plafonul depinde de o informație pe care aplicația nu o înregistrează, așa că cheltuiala rămâne în afara cheltuielilor deductibile cu motivul afișat, nu cu un plafon de 0 lei.',
  /** The 10 % warning distance (TASK 4). */
  warningBand:
    'Legea nu stabilește nicio distanță de avertizare față de un prag, așa că banda de 10 % este o politică de afișare a aplicației și nu primește nicio citare legală.',
  /** art. 174 alin. (7) lit. c) — the receipt fact is missing (TASK 5). */
  cassPensionReceipt:
    'Legea condiționează excepția de sumele primite ca pensie în anul fiscal, iar această faptă nu este înregistrată, așa că aplicația nici nu acordă, nici nu refuză excepția — marchează linia ca fiind de verificat.',
  /** art. 174 alin. (2) against art. 174 alin. (6) in a zero or loss year — research 25 gap 2. */
  cassZeroYear:
    'Legea nu spune dacă diferența de la alin. (6) supraviețuiește unui an cu venit zero sau negativ, așa că aplicația lasă plafonul neaplicabil și raportează diferența ca nedeasă.',
  /** art. 174 alin. (7) lit. b) — the income is declared, the amount is not. */
  cassIncomeWithoutAmount:
    'Profilul înregistrează că există venit de la art. 155 alin. (1) lit. c)-h), dar nu înregistrează cuantumul, așa că aplicația nu presupune nici o parte a condiției.',
  /** art. 174 alin. (7) lit. a) — a salary is declared, its amount is not. */
  salaryWithoutAmount:
    'Profilul înregistrează că există salariu, dar nu înregistrează cuantumul anual, fără de care testul de 6 salarii minime nu se poate face.',
  /** The B-19 flag: the rule package does not verify this profile's CASS quality. */
  cassFlagUnverified:
    'Pachetul de reguli nu confirmă calitatea de contribuabil la CASS pentru acest profil, așa că aplicația nu decide dacă pragul se aplică și lasă linia de verificat.',
  /** art. 154 alin. (1) — the closed list and the „nu se datorează" reading. */
  cassExemptionUnconfirmed:
    'Niciuna dintre valorile înregistrate pentru CASS nu este confirmată ca temei pentru un PFA cu activitate independentă, așa că aplicația nu alege o excepție și marchează linia ca fiind de verificat.',
  /** Suspension months — research 25 gap 1. */
  pensionSuspension:
    'Nicio prevedere verificată nu spune ce produce suspendarea pensiei asupra excepției de la art. 174 alin. (7) lit. c), așa că aplicația consemnează lunile și nu trage nicio concluzie din ele.',
  /** art. 153 alin. (2) — the exception needs both the insurance and its proof. */
  foreignInsuranceProof:
    'Art. 153 alin. (2) cere și dovada valabilității asigurării, iar dovada nu este înregistrată, așa că aplicația nu aplică excepția.',
  /** art. 174 alin. (8) — the previous-year route. */
  previousYearRoute:
    'Art. 174 alin. (8) cere o faptă din anul precedent, care nu este înregistrată, așa că aplicația nu extinde excepția pe baza acestui temei.',
  /** CF art. 148 / 170 / 174 state multipliers of salariul minim, never a lei figure. */
  smDerivedAmount:
    'Codul fiscal exprimă acest prag în multipli de salariu minim, nu în lei, iar valoarea salariului minim pe care o folosește aplicația vine din pachetul de reguli, nu din lege.',
  /** A run-rate projection is an assumption about the rest of the year. */
  runRateProjection:
    'Restul anului nu este încă înregistrat, așa că aplicația proiectează ritmul curent pentru întreg anul și spune că această cifră este o presupunere, nu o sumă încasată.',
  /** The money-conversion report: rounding direction (CF art. 66 alin. (1)). */
  roundingDirection:
    'Legea nu spune cum se rotunjesc sumele la conversie, așa că aplicația rotunjește la banul cel mai apropiat, jumătate în jos — aceeași direcție pe care o folosește art. 66 alin. (1).',
} as const;

/**
 * The statute text itself, one entry per field or row. Shown inside „Surse și note de interpretare",
 * never as the visible hint of a form field. The citation travels with the text.
 */
export const sources = {
  regimeOffered:
    'Cod fiscal art. 123 alin. (1). impozit pe profit nu este oferit: art. 13 alin. (1), art. 14 și art. 15 rezervă Titlul II persoanelor juridice, iar art. 120 a fost abrogat.',
  caenDoesNotChangeRegime:
    'Codul CAEN nu schimbă regimul fiscal; nu susține o normă de venit (nicio regulă de normă nu a fost verificată pentru 2026).',
  establishmentDate:
    'Art. 118 alin. (3): venitul realizat într-o fracțiune de an se consideră venit anual — baza nu se proratează. Necompletat = profil fără dată de înființare.',
  salarySixSm:
    'Art. 174 alin. (7) lit. a): diferența de la alin. (6) nu se datorează dacă salariul anual este cel puțin 6 salarii minime brute (24.300 lei în 2026). Sub acest prag se datorează diferența până la baza de 6 salarii minime brute — 10 % din acel deficit, deci maximum 2.430 lei în 2026, valoare atinsă doar când baza este zero. Diferența de la alin. (6) nu se deduce din venitul net anual impozabil: art. 118 alin. (2) lit. b) o exclude expres („cu excepția diferenței de contribuție de asigurări sociale de sănătate prevăzută la art. 174 alin. (6)”).',
  pensionerStatus:
    'Art. 150 alin. (1) din Codul fiscal: calitatea de pensionar este temeiul pentru care nu se datorează CAS pe venitul din activități independente. Nu este temeiul pentru CASS — art. 174 alin. (7) lit. c) se decide pe sumele primite ca pensii în anul fiscal, nu pe acest statut. Valoarea „nu este înregistrat" înseamnă că aplicația nu știe, nu că persoana nu este pensionară.',
  pensionReceipt:
    'Art. 174 alin. (7) lit. c) coroborat cu art. 99 alin. (1) din Codul fiscal: diferența de contribuție până la baza de 6 salarii minime brute nu se datorează dacă în anul fiscal persoana a primit cel puțin o sumă ca pensie. Fapta este încasarea din an, nu statutul. Cuantumul nu contează — lit. c) nu are niciun prag valoric, spre deosebire de lit. a) și lit. b). Excepția elimină doar diferența: contribuția de 10 % pe venitul net rămâne datorată.',
  pensionSuspension:
    'Fapta consemnată; efectul juridic nu este stabilit de nicio prevedere verificată (Cod fiscal, HG 1/2016, OPANAF 2.736/2025 nu spun ce produce suspendarea asupra art. 174 alin. (7) lit. c)). Aplicația consemnează lunile și nu trage nicio concluzie din ele.',
  previousYearException:
    'Art. 174 alin. (8) din Codul fiscal extinde excepția de la alin. (7) și la persoanele care în anul precedent s-au încadrat în art. 154 alin. (1) lit. a), b), e) sau f). Lista este închisă și NU include pensionarii, deci acest răspuns nu se deduce din calitatea de pensionar.',
  previousYearOption:
    'Art. 174 alin. (8) lit. b) din Codul fiscal: aceeași cale pentru persoanele care au optat pentru plata contribuției potrivit art. 180 alin. (1) în anul precedent.',
  foreignInsurance:
    'Art. 153 alin. (2) din Codul fiscal: persoana asigurată pentru boală și maternitate în alt stat UE/SEE/Elvețian sau cu acord bilateral nu are calitatea de contribuabil la CASS — dar numai dacă face și dovada valabilității asigurării. Nu are legătură cu pensia.',
  foreignInsuranceProof:
    'Art. 153 alin. (2) din Codul fiscal cere ambele: asigurarea și „dovada valabilității asigurării" stabilită prin ordin comun A.N.A.F. / C.N.A.S. Fără dovadă, excepția nu produce nimic.',
  cassStatus:
    'CASS: „exceptat" (art. 154 alin. (1) — o listă închisă de categorii, niciuna nu acoperă un PFA cu activitate independentă) și „nu se datorează" sunt ambele neconfirmate ca temei pentru un PFA. Titlul V nu folosește termenul „scutire" — de aceea nici acest formular nu-l folosește.',
  vatExceedanceDate:
    'Data la care cifra de afaceri a depășit pragul de TVA (art. 310 alin. (1)); obligația de înregistrare intervine cel târziu la această dată (art. 316 alin. (1) lit. b)). Necompletat = aplicația nu cunoaște data și nu afișează niciun termen de înregistrare — nu inventează unul.',
  eFacturaDeadline:
    'OUG 120/2021 art. 10 alin. (7): termenul-limită pentru transmiterea unei facturi în sistemul național RO e-Factura este de 5 zile lucrătoare de la data emiterii facturii (modificat de OUG 89/2025 pct. 2 art. X, în vigoare de la 01-01-2026).',
  capReadingChoice:
    'Plafonul este măsurat pe baza art. 68 alin. (6) sub interpretarea «înregistrată» (pre-plafon): baza scade cheltuielile deductibile așa cum au fost înregistrate, nu așa cum rămân după celelalte plafoane alin. (5). Legea nu stabilește care interpretare se aplică — nicio normă nu prescrie o ordine — deci ambele cifre sunt afișate. Cea aplicată este mai puțin generoasă și nu poate produce subimpozitare.',
} as const;
