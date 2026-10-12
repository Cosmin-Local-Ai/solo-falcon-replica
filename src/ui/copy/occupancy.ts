/**
 * PG-6h-3 (D-OCC-1) — the sentences of the occupancy sheet, OPANAF nr. 381 din 24.03.2026
 * (MO I nr. 250 din 31.03.2026), which abrogates OPANAF nr. 398/2021.
 *
 * **Every citation of a fișă in this application names 381/2026, never 398/2021.** That is not
 * pedantry: ANAF's own D212 instructions (OPANAF 2736/2025, MO 1207/29.12.2025) still point a tourist-
 * rental taxpayer at „Fișa capacității de cazare aprobată prin OPANAF nr. 398/2021”, an order that no
 * longer exists, because those instructions predate the 381/2026 order. A sentence copied from ANAF would
 * cite an abrogated act; `docs/ai/research/38_art68x3_cass_and_occupancy_order.md` §2 records the
 * inconsistency, and this file is where the corrected form lives.
 *
 * Three things the wording must never do, each of them a defect class this repository has already paid
 * for:
 *  - **imply a filing.** The order says „să completeze și să păstreze”, and Annex 3 says the copy is kept
 *    by the taxpayer. There is no submission, no upload, no "send to ANAF", and no deadline in this
 *    module — the only deadline is the taxpayer's own duty to keep the sheet. A deadline widget here would
 *    invent an obligation.
 *  - **claim the app is an archive.** It is the taxpayer's own copy. Deleting it does not discharge the
 *    duty, and the copy says so rather than letting the reader discover it.
 *  - **let a fiscal figure appear next to a guest row.** The sheet is not a revenue source, not a room
 *    count and not an occupancy statistic; nothing on this page shows a money amount derived from a stay.
 */
export const occupancy = {
  title: 'Fișa de ocupare a capacității de cazare',
  subtitle:
    'Model aprobat prin OPANAF nr. 381 din 24.03.2026 (MO I nr. 250 din 31.03.2026). Se completează pentru fiecare cameră, pentru fiecare an.',

  // ── Retention, not filing ────────────────────────────────────────────────
  retention: {
    heading: 'Se păstrează de către contribuabil. Nimic nu se trimite la ANAF.',
    body:
      'Ordinul spune „să completeze și să păstreze”, iar anexa 3: „Se întocmește un exemplar, de către ' +
      'contribuabil. Se păstrează de către contribuabil.” Aplicația nu trimite nicăieri fișa și nu ' +
      'construiește nicio cale de trimitere.',
    ownCopy:
      'Ceea ce vezi aici este copia ta, a contribuabilului, a unui document pe care legea te obligă să-l ' +
      'păstrezi. Aplicația nu este arhiva ANAF.',
    deletion:
      'Ștergerea elimină fișa din datele locale de pe acest dispozitiv. Ea nu te eliberează de obligația ' +
      'de a păstra fișa: dacă ți se aplică, trebuie să ai exemplarul tău undeva.',
    deleted: 'Fișa a fost ștearsă din datele locale.',
  },

  // ── Third-party personal data ────────────────────────────────────────────
  privacy: {
    heading: 'Acestea sunt date despre alte persoane',
    body:
      'Fișa conține numele și CNP-ul — sau seria și numărul actului de identitate, când persoana nu are ' +
      'CNP — ale fiecărei persoane cazate, împreună cu prima și ultima zi a șederii. Aceste date rămân în ' +
      'aplicația de pe acest dispozitiv: nu pleacă prin rețea, nu intră în nicio trimitere și nu ajung în ' +
      'nicio cifră din aplicație.',
    exportIsExplicit:
      'Descărcarea fișei este un act pe care îl faci tu, apăsat de tine. Nicio altă ieșire a aplicației ' +
      'nu conține date despre cazați.',
  },

  // ── Who completes it (Instructions pct. 1) ──────────────────────────────
  scope: {
    heading: 'Cine completează fișa',
    body:
      'Ordinul se adresează ambelor categorii de contribuabili: (a) 1–7 camere închiriate pe termen scurt ' +
      'în locuințe proprietate personală, indiferent de numărul de locuințe; (b) activitatea independentă ' +
      'de cazare și situația cu mai mult de 7 camere.',
    notGatedOnTitle:
      'Aplicația nu alege în locul tău dacă ți se aplică. Titlul fiscal sub care îți încasezi venitul — ' +
      'cedarea folosinței bunurilor sau art. 68^3 — nu schimbă obligația de a completa și păstra fișa, de ' +
      'aceea fișa este disponibilă aici în ambele cazuri.',
  },

  // ── The definitional rule the dates are read under ───────────────────────
  definition: {
    shortTerm:
      'Pe termen scurt înseamnă închirierea neîntreruptă a unei camere de către aceeași persoană, pentru ' +
      'perioade de maximum 30 de zile într-un an calendaristic.',
    fractionOfDay:
      'Închirierea sau ocuparea pentru o fracțiune de zi se consideră închiriere/ocupare pentru o zi.',
    citation: 'OPANAF nr. 381/2026, instrucțiuni pct. 2.',
    overCeiling: (days: number): string =>
      `Această ședere are ${days} de zile, mai mult decât cei 30 de zile din definiția închirierii pe ` +
      'termen scurt. Verifică cum se încadrează perioada aceasta; aplicația înregistrează ceea ce ai ' +
      'completat și nu modifică nimic.',
  },

  // ── The form itself ──────────────────────────────────────────────────────
  form: {
    sectionOne: 'Secțiunea I — imobil',
    sectionTwo: 'Secțiunea II — camera și persoanele cazate',
    year: 'Anul',
    address: 'Adresa imobilului',
    room: 'Camera / spațiul amenajat',
    guestName: 'Numele persoanei cazate',
    identifier: 'CNP sau serie și număr act',
    identifierKind: 'Ce ai completat',
    identifierKindCnp: 'CNP',
    identifierKindId: 'Serie și număr act de identitate',
    firstDay: 'Prima zi',
    lastDay: 'Ultima zi',
    addSheet: 'Adaugă fișă',
    addStay: 'Adaugă ședere',
    deleteSheet: 'Șterge fișa',
    deleteStay: 'Șterge șederea',
    download: 'Descarcă fișa (CSV)',
    sheetHeading: (year: number, room: string): string => `Fișa ${year} — ${room}`,
    staysCount: (n: number): string => `${n} ${n === 1 ? 'persoană cazată' : 'persoane cazate'}`,
    emptyTitle: 'Nicio fișă de ocupare',
    empty:
      'Nicio fișă completată. Completează una doar dacă ți se aplică obligația din OPANAF nr. 381/2026.',
    noStays: 'Această fișă nu are nicio ședere înregistrată.',
  },

  // ── The identifier is recorded, not corrected ────────────────────────────
  identifier: {
    /**
     * A flag, never a block. A CNP has a check digit, but the app records what the taxpayer recorded:
     * refusing a stay because a CNP looks wrong would put the application in the position of correcting a
     * document it did not issue and cannot see. The wording says what is suspicious and says the value was
     * kept.
     */
    suspect:
      'Valoarea nu are 13 de cifre, cum are un CNP. Aplicația a păstrat ceea ce ai scris — nu corectează ' +
      'și nu refuză șederea.',
  },

  // ── Export ───────────────────────────────────────────────────────────────
  export: {
    /** The sheet's own file. Deliberately separate from the RJIP register. */
    csvHeader: 'An;Adresa imobilului;Camera;Nume persoana cazata;Identificator;Tip identificator;Prima zi;Ultima zi',
    fileName: (year: number, room: string): string => `Fisa_ocupare_${year}_${room}.csv`,
    generated: (year: number, stays: number): string =>
      `Fișa ${year} a fost descărcată (${stays} ${stays === 1 ? 'ședere' : 'șederi'})`,
    nothingToExport: 'Nu ai nimic de descărcat — fișa nu are nicio ședere.',
  },

  // ── Entry point, from Settings ───────────────────────────────────────────
  entry: {
    label: 'Fișa de ocupare a capacității de cazare',
    hint:
      'Se completează per cameră, per an, și se păstrează de contribuabil. Nimic nu se trimite la ANAF.',
  },

  validation: {
    yearRequired: 'Anul este obligatoriu și trebuie să fie un an calendaristic.',
    addressRequired: 'Adresa imobilului este obligatorie.',
    roomRequired: 'Camera sau spațiul amenajat este obligatoriu.',
    guestNameRequired: 'Numele persoanei cazate este obligatoriu.',
    identifierRequired: 'CNP-ul sau seria și numărul actului sunt obligatorii.',
    dateRequired: 'Ambele zile sunt obligatorii.',
    dateOrder: 'Ultima zi nu poate fi înainte de prima zi.',
    dateInvalid: (value: string): string => `Data „${value}” nu este o dată calendaristică reală.`,
  },
};
