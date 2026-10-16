/**
 * PG-6e (B-31, D-FA-1) — the sentences of the fixed-asset register and of fiscal depreciation.
 *
 * Three rules this module keeps, each of them a defect class the repository has already paid for:
 *
 *  - **A construction is named as a construction.** The degresive switch at year 6 and the first-year
 *    1/12 pro-rating are ours: `docs/ai/research/36_fixed_assets_and_depreciation_2026.md` §12.2 is a
 *    documented negative — no daily formula, no monthly table and no first-year fraction exists anywhere
 *    in the 624 pages of Partea I. A number can be right and the sentence above it still be a defect, so
 *    the wording says which part is quoted and which part is ours.
 *  - **A silence is named as a silence.** Where the law does not answer, the screen refuses and names the
 *    two sides; it never shows a figure and never picks.
 *  - **The excess over the ceiling is lost, not deferred.** §12.13 records that the amount above
 *    1.500 lei/lună „nu se reportează și nu se recuperează în anii următori" — a corroborated secondary
 *    reading, not a quoted statutory text, so it is stated as a consequence and never as a citation.
 *
 * The retention sentences are the **current** ones. The 10-year rule people remember was abrogated by
 * OMF nr. 1.447 din 2 mai 2023 (MO nr. 453 din 24 mai 2023, art. II pct. 2); quoting it would be a
 * factual error on screen, not a stylistic choice.
 */
export const assets = {
  title: 'Mijloace fixe și amortizare',
  subtitle:
    'Registrul de evidență al bunurilor amortizabile și calculul amortizării fiscale, pentru regimul real în sistem real.',

  // ── What the register is, and what it is not ─────────────────────────────
  intro: {
    heading: 'Amortizarea se calculează din faptele declarate aici. Nicio faptă nu este presupusă.',
    body:
      'Un bun devine mijloc fix amortizabil prin faptele lui: data intrării în patrimoniu, data punerii în ' +
      'funcțiune, valoarea fiscală, durata normală de funcționare pe care o stabilești tu și metoda de ' +
      'amortizare. Dacă una dintre ele lipsește, aplicația nu completează golul — refuză și spune ce anume ' +
      'lipsește.',
    notInferred:
      'Aplicația nu deduce un mijloc fix dintr-o cheltuială, dintr-un furnizor sau din codul CAEN. O ' +
      'achiziție de bun amortizabil nu este cheltuială deductibilă; deductibilă este amortizarea lui.',
    purchaseIsNotAnExpense:
      'Prețul de cumpărare al unui bun amortizabil nu scade din venit în anul plății. Art. 68 alin. (7) ' +
      'lit. h) scoate explicit din cheltuielile deductibile „cheltuielile de dobândire a bunurilor și ' +
      'drepturilor amortizabile”.',
  },

  // ── The form ─────────────────────────────────────────────────────────────
  form: {
    addAsset: 'Adaugă un mijloc fix',
    editAsset: 'Editează mijlocul fix',
    deleteAsset: 'Șterge',
    emptyTitle: 'Niciun mijloc fix înregistrat',
    empty:
      'Cât timp nu ai adăugat niciun bun, nicio amortizare nu intră în calcul. Aceasta este starea ' +
      'corectă dacă nu ai achiziționat bunuri amortizabile.',
    label: 'Denumirea bunului',
    entryDate: 'Data intrării în patrimoniu',
    entryDateHint:
      'La această dată se verifică pragul de 5.000 lei și la această dată se exercită opțiunea din ' +
      'art. 28 alin. (21) — nu la data plății.',
    putInFunctionDate: 'Data punerii în funcțiune',
    putInFunctionDateHint:
      'Amortizarea începe în luna următoare acestei date. Expresia „punere în funcțiune” nu este definită ' +
      'nicăieri în legea fiscală; ancorarea în procesul-verbal de dare în folosință este doctrină de ' +
      'practician, nu text de lege.',
    fiscalValue: 'Valoarea fiscală (lei)',
    fiscalValueHint:
      'Include și taxa pe valoarea adăugată devenită nedeductibilă — pct. 28 lit. b) din normele Titlului ' +
      'II o spune la modul afirmativ: „în valoarea fiscală a mijloacelor fixe, la data intrării în ' +
      'patrimoniu, se include și taxa pe valoarea adăugată devenită nedeductibilă”.',
    nonDeductibleVatIncluded: 'Dintre care TVA devenită nedeductibilă',
    nonDeductibleVatIncludedHint:
      'Nu se adaugă la valoare — este o parte din ea, înregistrată ca atare. Dobânzile, comisioanele de ' +
      'acordare și taxa de arhivă nu intră deloc în valoarea de amortizabil.',
    normalLifeMonths: 'Durata normală de funcționare (luni)',
    normalLifeMonthsHint:
      'Durata o stabilești tu, în interiorul intervalului din catalog: pct. 27 vorbește despre „durata ' +
      'normală de funcţionare stabilită de contribuabil”. Aplicația nu alege o clasă de catalog în ' +
      'locul tău.',
    method: 'Metoda de amortizare',
    methodLiniar: 'Liniară',
    methodDegresiv: 'Degresivă',
    methodHint:
      'Regimul degresiv are coeficienții din art. 28 alin. (7): 1,5 pentru o durată între 2 și 5 ani, ' +
      '2,0 între 6 și 10 ani și 2,5 pentru o durată mai mare de 10 ani. Sub 2 ani nu există coeficient.',
    acquisition: 'Modul de dobândire',
    acquisitionCumparare: 'Cumpărare',
    acquisitionAport: 'Aport din patrimoniul personal',
    acquisitionProductie: 'Producție proprie',
    paymentState: 'Starea plății',
    paymentStateAchitat: 'Plătit',
    paymentStateInRate: 'În rate',
    paymentStateNeachitat: 'Neplătit',
    paidOn: 'Data plății',
    subThresholdElection: 'Opțiunea pentru un bun sub pragul de 5.000 lei',
    subThresholdElectionIntreg: 'Deductă integral la punerea în funcțiune',
    subThresholdElectionAmortizare: 'Amortizează',
    subThresholdElectionHint:
      'Opțiunea se exercită la data intrării în patrimoniu — pct. 31 din normele Titlului II — și se face ' +
      'pentru fiecare bun în parte. O opțiune luată acum nu poate fi schimbată ulterior, de aceea ' +
      'aplicația nu alege niciuna în locul tău.',
    isM1Vehicle: 'Este autoturism din categoria M1',
    isM1VehicleHint:
      'M1 înseamnă cel mult 9 locuri, inclusiv conducătorul auto, omologat RNTR 2 / OMMLTL 211/2003.',
    m1ExceptionCategory: 'Categoria de excepție de la plafonul de 1.500 lei/lună',
    m1ExceptionNone: 'Fără excepție — se aplică plafonul',
    m1ExceptionUrgenta: 'Vehicule de intervenție în situații de urgență, de pază și curierat',
    m1ExceptionTestDrive:
      'Agenți de vânzări și de achiziții, precum și pentru test drive și pentru demonstrații',
    m1ExceptionTransport: 'Transport de persoane, inclusiv taximetre, cu plata inclusă în preț',
    m1ExceptionServicii:
      'Servicii contra cost, inclusiv închiriere, leasing operațional și școli de șoferi',
    disposedOn: 'Data scăderii din gestiune',
    disposalKind: 'Modul ieșirii din patrimoniu',
    disposalKindVanzare: 'Vânzare',
    disposalKindCasare: 'Casare',
    disposalKindScoatere: 'Scoatere din gestiune',
    disposalKindHint:
      '„Casare” nu înseamnă simplă scoatere din uz. pct. 29 cere scoaterea din funcțiune urmată de ' +
      'dezmembrarea părților componente și valorificarea lor.',
    // B-65 / brief 76 — the second ceiling. Titlul II pct. 27 măsoară residualul în luni; Titlul IV pct. 7
    // lit. o) îl măsoară în bani, la prețul înstrăinării. Fără preț, a doua limită nu există ca
    // cifră, iar aplicația spune asta în loc să aplice doar prima.
    //
    // B-157 — citarea este „pct. 7 lit. o)” fără alineat, și asta este intenționat. research/55 §3 a
    // confirmat litera și textul verbatim în normele Titlului IV actualizate pentru 2026, dar nu a putut
    // confirma alineatul. D-CITE-1: sensul îl poartă textul citat, localizatorul este secundar. Nu se
    // introduce un alineat citit dintr-o preluare comercială.
    disposalProceeds: 'Suma realizată din înstrăinare (lei)',
    disposalProceedsHint:
      'Normele Titlului IV pct. 7 lit. o) limitează valoarea rămasă neamortizată „la nivelul '
      + 'venitului realizat din înstrăinare”, adică la prețul cu care bunul a fost vândut. Fără această sumă '
      + 'a doua limită nu poate fi măsurată, iar cifra calculată rămâne plafonul de la pct. 27, nu '
      + 'deductibilul final. Nu este o sumă derivată din valoarea fiscală sau din residual: este prețul '
      + 'tranzacției, și numai tu îl poți declara. Pentru un bun care nu este un autoturism din categoria '
      + 'M1, plafonul pct. 27 nu se aplică deloc — norma este scrisă pentru mijloacele de transport din '
      + 'categoria M1 — iar prețul înstrăinării rămâne singura limită a valorii neamortizate.',
    save: 'Salvează',
    cancel: 'Renunță',
    deleted: 'Bunul a fost șters din registrul local.',
    added: 'Bunul a fost adăugat în registrul local.',
    labelRequired: 'Scrie o denumire pentru bun.',
  },

  // ── Linking an expense to an asset (B-108) ───────────────────────────────
  //
  // The register computes a schedule; a hand-typed `depreciation_business_asset` expense records the same
  // cost a second way. art. 68 alin. (4) lit. d) connects the two routes but gives no rule for saying which
  // asset a typed line covers, so the link is only ever the person's own. Without it the conflict stays
  // register-wide — a refusal that is honest about being broad — and with it the refusal narrows to the one
  // asset that was named. The v22→v23 chain step opens the field and attributes nothing.
  expense: {
    field: 'Mijlocul fix căruia îi aparține cheltuiala',
    none: '— niciun mijloc fix —',
    hint:
      'Leagă cheltuiala de bunul căruia îi aparține, ca aplicația să poată spune al cărui plan de ' +
      'amortizare i se opune. Aplicația nu ghicește bunul după sumă, după dată, după furnizor sau după ' +
      'categoria de cheltuială: art. 68 alin. (4) lit. d) leagă cele două căi de calcul, dar nu dă nicio ' +
      'regulă de atribuire. Cât timp legătura lipsește, refuzul acoperă tot registrul și aplicația spune asta.',
    rowLabel: 'Bun legat',
  },

  // ── The schedule ─────────────────────────────────────────────────────────
  schedule: {
    heading: 'Planul de amortizare',
    year: 'An',
    months: 'Luni',
    uncapped: 'Amortizare calculată',
    deductible: 'Deductibil',
    lost: 'Pierdut definitiv',
    total: 'Total',
    startedIn: 'Amortizarea începe în',
    firstYearProRated:
      'Anul primului an fiscal este calculat la 1/12 din cota anuală pentru fiecare lună rămasă în an. ' +
      'Art. 28 alin. (12) lit. a) dă numărul de luni, nu fracțiunea — fracțiunea este construcția ' +
      'noastră, nu text de lege.',
    degresivSwitch:
      'Din al șaselea an regimul degresiv trece la linie dreaptă pe valoarea rămasă. Este modul în care ' +
      'lucrare exemplul din pct. 25 („114.688/5 ani”), dar textul nu enunță regula în general — este ' +
      'construcția noastră, citită din exemplu.',
    degresivCoefficients: 'Coeficient aplicat: {coefficient}, pentru o durată de {years} ani.',
    m1Capped:
      'Amortizarea acestui autoturism M1 este limitată la 1.500 lei pentru fiecare lună. Ce depășește ' +
      'acest plafon se pierde definitiv: nu se reportează și nu se recuperează în anii următori.',
    m1CapPerVehicle:
      'Plafonul se aplică pentru fiecare autoturism în parte. Mai multe autoturisme pot fi amortizate ' +
      'simultan, fiecare până la 1.500 lei pe lună.',
    m1ExceptionApplied:
      'Pentru acest autoturism este invocată o categorie de excepție de la art. 28 alin. (14), deci ' +
      'plafonul de 1.500 lei pe lună nu se aplică amortizării.',
    m1ExceptionNoEvidence:
      'Legea nu spune ce document adeverește una dintre aceste categorii de excepție. Singura cerință de ' +
      'justificare din normele Titlului IV este foaia de parcurs, și ea privește regula de 50 % pentru ' +
      'cheltuielile de funcționare, nu amortizarea.',
    disposalHeading: 'Scăderea din gestiune',
    disposalUnamortised: 'Valoare neamortizată',
    disposalRemainingMonths: 'Luni rămase din durata declarată',
    disposalCap: 'Plafon pct. 27 — 1.500 lei × luni rămase',
    disposalProceedsLimit: 'Limita din prețul înstrăinării — pct. 7 lit. o)',
    disposalDeductible: 'Deductibil la scăderea din gestiune',
    disposalLost: 'Pierdut definitiv la scăderea din gestiune',
    disposalRule:
      'pct. 27: la scăderea din gestiune, valoarea neamortizată este deductibilă în limita a 1.500 lei ' +
      'înmulțit cu numărul de luni rămase de amortizat din durata normală de funcționare stabilită de ' +
      'contribuabil. Lunile rămase se calculează din durata pe care ai declarat-o aici, nu dintr-o ' +
      'clasă de catalog.',
    // B-156 — pct. 27 este scrisă pentru „mijloacele de transport din categoria M1”. Un laptop scos din
    // gestiune nu are plafon M1; are aceeași valoare neamortizată, limitată de pct. 7 lit. o) la prețul
    // înstrăinării. Nu scoatem plafonul — punem plafonul potrivit pe bunul potrivit.
    disposalRuleNonM1:
      'pct. 27 nu se aplică acestui bun: norma este scrisă „la momentul scăderii din gestiune a '
      + 'mijloacelor de transport din categoria M1” și este legată de plafonul de 1.500 lei/lună din '
      + 'art. 28 alin. (14), iar acest bun nu este un autoturism M1. Valoarea neamortizată rămâne și ea '
      + 'are o limită — pct. 7 lit. o) o limitează „la nivelul venitului realizat din înstrăinare”, adică '
      + 'la prețul cu care bunul a fost vândut. Faptul că nu este M1 este declarat de tine, nu dedus din '
      + 'numele bunului.',
    // B-153 / D-DEPR-1 — the stop rule is a reading, and the card says so instead of presenting it as a
    // rule. The rejected alternative is written down here, not left in a commit message.
    stoppedAtDisposal:
      'Planul de amortizare se oprește în luna în care bunul a fost scos din evidență: lunile de după '
      + 'acea lună nu se amortizează, iar bunul rămâne cu o valoare neamortizată. Nicio regulă nu spune '
      + 'acest lucru — art. 28 alin. (12) lit. a)–n) nu vorbesc despre vânzare sau scoatere din evidență, '
      + 'normele Titlului II pct. 25–31 nu conțin nicio regulă de oprire, OMFP 170/2015 nici atât. '
      + 'Sprijinul citirii: pct. 27 numără „lunile rămase de amortizat” „la momentul scăderii din '
      + 'gestiune”, iar art. 28 alin. (17) și pct. 7 lit. o) calculează cifrele de la ieșire pe '
      + 'amortizarea efectiv luată. Citirea alternativă, respinsă și consemnată: amortizarea se oprește '
      + 'luna DUPĂ ieșire, prin simetrie cu regula expresă de începere din art. 28 alin. (12) lit. a) '
      + '(„începând cu luna următoare celei în care … se pune în funcțiune”) — este un argument, nu un '
      + 'text. Ce nu este o citire: planul și figura de la ieșire trebuie să numere aceleași luni.',
    notDeductibleYet:
      'Cifrele de mai jos intră în estimare ca cheltuială cu amortizarea, bun cu bun, pentru anul fiscal ' +
      'afisat. Nu sunt o înregistrare în registrul de cheltuieli: sunt calculate din faptele declarate ' +
      'aici și din art. 28.',
  },

  // ── B-93: whether this asset's schedule actually reaches the estimate ──────
  /**
   * Before B-93 the schedule was computed, shown here and printed in the register, and the estimate then
   * deducted a different figure — one the taxpayer had typed. These are the sentences that say which of
   * the two the estimate used, and why a schedule can be withheld.
   */
  posting: {
    posted: 'Planul acestui bun intră în estimare pentru {year}: {amount}.',
    ceilingTravels:
      'Suma de mai sus este cea de după plafonul de 1.500 lei pe lună din art. 28 alin. (14), nu ' +
      'amortizarea brută. Cifra de dinainte de plafon și diferența pierdută definitiv sunt în tabel.',
    conflictHeading: 'Planul nu intră în estimare',
    conflict:
      'Ai înregistrat deja o cheltuială cu amortizarea pe locație. Planul calculat din faptele acestui ' +
      'bun nu este adăugat peste ea: adunate, aceeași amortizare s-ar deduce de două ori. Aplicația nu ' +
      'adună cele două, nu alege valoarea mai mare și nu preferă în tăcere niciuna — planul este reținut ' +
      'iar cifra estimării nu se mișcă.',
    conflictExpenses: 'Cheltuieli înregistrate manual: {ids}.',
    conflictWhyAll: 
      'Înregistrarea de cheltuială nu face legătura dintre o sumă și un mijloc fix, deci aplicația nu poate ' +
      'să spună ce bun acoperă cheltuiala tastată. Cât timp există o astfel de cheltuială în perioadă, ' +
      'niciun plan din registru nu este postat.',
    conflictFix:
      'Ce poți face: șterge cheltuiala cu amortizarea înregistrată manual și lasă registrul să calculeze, ' +
      'sau păstreaz-o și nu mai aștepta nicio deducere din registru pentru acest an.',
  },

  // ── The three silences ───────────────────────────────────────────────────
  gaps: {
    heading: 'Aplicația nu alege în locul tău',
    punereInFunctiune:
      'Lipsește data punerii în funcțiune, iar fără ea nu există prim an de amortizare. Expresia nu este ' +
      'definită nicăieri în legea fiscală, deci aplicația nu poate deduce data din alte fapte. Ce ai ' +
      'putea aduce: un proces-verbal de dare în folosință — ancorarea în acest document este doctrină de ' +
      'practician, nu text de lege.',
    aport:
      'Bunul ar intra în patrimoniu ca aport din patrimoniul personal, iar legea nu răspunde clar dacă ' +
      'amortizarea lui este deductibilă. O parte susține că nu este, sub art. 68 alin. (7) lit. k^1), ' +
      'care exclude „cheltuielile cu amortizarea bunurilor din patrimoniul personal afectate exercitării ' +
      'activității”. Textul care merge în sens contrar este pct. 44 lit. c) din normele Titlului I, care ' +
      'definește valoarea fiscală a bunurilor „dobândite cu titlu gratuit ori constituite ca aport” pe ' +
      'baza costului de achiziție. Regula de evaluare nu este o permisiune de deducere, de aceea ' +
      'aplicația refuză și numează cele două texte.',
    plata:
      'Bunul a fost pus în funcțiune într-un an și plătit în altul, iar legea nu spune care dintre cele ' +
      'doua date declanșează amortizarea. Nu există nicio sursă ANAF primară care să spună că amortizarea ' +
      'este deductibilă indiferent de plată, și niciuna care s-o condiționeze de plată. Citează pe care ' +
      'o aplică această aplicație: amortizarea începe în anul punerii în funcțiune, chiar dacă plata ' +
      'vine mai târziu — este o lectură, nu un text.',
    optiuneAlin21:
      'Bunul este sub pragul de 5.000 lei și nu ai declarat nicio opțiune. Art. 28 alin. (21) dă două ' +
      'căi alternative, iar pct. 31 cere opțiunea la data intrării în patrimoniu. Absența unei opțiuni ' +
      'nu este ea însăși o opțiune, de aceea aplicația nu calculează nimic.',
    durata:
      'Lipsește durata normală de funcționare. pct. 27 o lasă în mod expres la contribuabil — „stabilită ' +
      'de contribuabil” —, deci fără ea nu există nici cotă anuală, nici plafon la scăderea din ' +
      'gestiune. Aplicația nu alege o durată din catalog în locul tău.',
    coeficient:
      'Regimul degresiv are coeficienți doar pentru durate de 2-5 ani, 6-10 ani și peste 10 ani. Pentru ' +
      'o durată sub 2 ani art. 28 alin. (7) nu dă niciun coeficient, iar aplicația nu inventează unul.',
  },

  // ── The two vehicle lists ────────────────────────────────────────────────
  vehicleLists: {
    heading: 'Două liste de excepții, două prevederi diferite',
    body:
      'Art. 28 alin. (14) are patru categorii de excepție de la plafonul de 1.500 lei pe lună pentru ' +
      'amortizare și cuprinde test drive și demonstrații. Art. 68 alin. (7) lit. k) are cinci categorii, ' +
      'fără test drive, și adaugă vehiculele utilizate ca mărfuri în scop comercial.',
    closing:
      'Art. 68 alin. (7) lit. k) se încheie cu „Cheltuielile care intră sub incidența acestor prevederi ' +
      'nu includ cheltuielile privind amortizarea”. De aceea lista de acolo nu mută nimic în calculul ' +
      'de aici.',
    oneCarLimit:
      'Limita de un singur autoturism privește cheltuielile de funcționare, nu amortizarea. Mai multe ' +
      'autoturisme pot fi amortizate în același timp; un singur autoturism poate purta cheltuielile de ' +
      'funcționare.',
  },

  // ── The retained documents (D-FA-2) ──────────────────────────────────────
  documents: {
    tabTitle: 'Registru-inventar și fișa mijlocului fix',
    heading: 'Două documente pe care trebuie să le păstrezi, generate din registrul de aici',
    body:
      'Ambele se întocmesc din faptele bunurilor înregistrate în aplicație și se descarcă. Nimic nu se ' +
      'trimite la ANAF: obligația este de păstrare.',
    registerTitle: 'Registrul-inventar',
    registerCode: 'cod 14-1-2/b',
    registerCitation:
      'OMFP nr. 170/2015, cap. III pct. 9: contabilitatea în partidă simplă utilizează Registrul-jurnal ' +
      'de încasări și plăți (cod 14-1-1/b) și Registrul-inventar (cod 14-1-2/b).',
    ficheTitle: 'Fișa mijlocului fix',
    ficheCode: 'cod 14-2-2',
    ficheCitation:
      'OMFP nr. 170/2015, cap. III pct. 17: „Evidența imobilizărilor corporale (mijloace fixe) se ține cu ' +
      'ajutorul Fișei mijlocului fix (cod 14-2-2)”.',
    ficheInferred:
      'Fișa nu se numără printre registrele obligatorii din cap. III pct. 9, deși este item 3 din ' +
      'nomenclatorul cap. V. Durata de păstrare indicată pentru ea este inferată de aplicație din pct. 1^1 ' +
      'și din pct. 17 — nu este o regulă scrisă expres pentru acest document.',
    retentionHeading: 'Cât se păstrează',
    retentionRegister:
      'Cap. IV pct. 1^1 alin. (1): registrele de contabilitate obligatorii și documentele justificative ' +
      'care stau la baza înregistrărilor se păstrează 5 ani, calculați de la 1 iulie a anului următor ' +
      'celui încheierii exercițiului financiar în care au fost întocmite.',
    retentionProvenance:
      'Cap. IV pct. 1^1 alin. (2): documentele justificative care atestă proveniența unor bunuri cu ' +
      'durată de viață mai mare de 5 ani se păstrează pe perioada corespunzătoare duratei de viață utilă ' +
      'a acestora.',
    retentionAbrogated:
      'Regula de 10 ani pe care mulți o țin minte nu mai este în vigoare. A fost abrogată de OMF nr. 1.447 ' +
      'din 2 mai 2023 (MO nr. 453 din 24 mai 2023, art. II pct. 2), care a introdus pct. 1^1 și a abrogat ' +
      'punctele 2-4 ale capitolul IV.',
    retentionOwnCopy:
      'Ceea ce descarci este copia ta, a contribuabilului. Aplicația nu este arhiva ANAF și nu păstrează ' +
      'documentul în locul tău.',
    retentionDeletion:
      'Ștergerea unui bun din registru elimină documentul generat din datele locale. Nu te eliberează de ' +
      'obligația de a păstra documentul pe durata care ți se aplică.',
    emptyTitle: 'Niciun document de generat',
    empty:
      'Ambele documente se întocmesc din bunurile înregistrate. Cât timp registrul este gol, nu există ce ' +
      'să genereze.',
    downloadRegister: 'Descarcă registrul-inventar',
    downloadFiche: 'Descarcă fișa mijlocului fix',
    nothingToExport: 'Nu există niciun bun înregistrat de exportat.',
    generated: 'Document generat din registrul local.',
    csvHeader:
      'Denumire bun;Data intrării în patrimoniu;Data punerii în funcțiune;Valoare de intrare (lei);' +
      'Valoare fiscală (lei);Durata normală de funcționare (luni);Metodă;' +
      'Amortizare cumulată (lei);Valoare rămasă (lei)',
    ficheCsvHeader:
      'Denumire bun;Cod;Data intrării în patrimoniu;Data punerii în funcțiune;Mod dobândire;' +
      'Valoare de intrare (lei);TVA nedeductibilă inclusă (lei);Metodă;Durata (luni);' +
      'An fiscal;Luni în an;Amortizare calculată (lei);Amortizare deductibilă (lei);' +
      'Pierdut definitiv (lei);Valoare rămasă (lei)',
    retentionLine: 'Durată de păstrare indicată: {years} ani de la 1 iulie a anului următor.',
    retentionLineUsefulLife:
      'Durată de păstrare indicată: pe toată durata de viață utilă a bunului, pentru că documentul ' +
      'atestă proveniența unui bun cu viață utilă mai mare de 5 ani.',
  },

  // ── Provenance ───────────────────────────────────────────────────────────
  provenance: {
    threshold:
      'Pragul de 5.000 lei este cel din art. 28 alin. (21), aplicabil de la anul fiscal 2026. Nu există ' +
      'nicio indexare prin hotărâre de guvern pentru acest prag, de aceea rămâne cifra anului 2026.',
    vat:
      'TVA devenită nedeductibilă intră în valoarea fiscală a mijlocului fix — pct. 28 lit. b) din ' +
      'normele Titlului II. Aceeași regulă nu se aplică cheltuielilor curente; întrebarea despre TVA în ' +
      'baza de 50 % rămâne deschisă.',
  },
};
