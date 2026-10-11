/**
 * TASK 7 — copy for the Setări page.
 *
 * The fiscal tab is where this app used to print the most law at a person who was trying to fill a
 * form. Two changes are made here, and only here:
 *
 * - The **visible hint** is one plain sentence about what the field means or what the app does not
 *   conclude from it.
 * - The **statute text** moves to `notes.ts` → `sources`, reachable through „Surse și note de
 *   interpretare", with its citation kept. Nothing is deleted; it is no longer in the middle of the
 *   form.
 *
 * The select option captions are copy, not the stored value. `obligatoriu`, `exempt` and `neplata`
 * are internal names for the CASS quality; the person sees Romanian.
 */

export const settings = {
  title: 'Setări',
  subtitle: 'Datele PFA, regim fiscal, e-Factura, conturi bancare și cont personal',
  tabs: {
    pfa: 'PFA',
    fiscal: 'Regim fiscal',
    eFactura: 'e-Factura',
    bankAccounts: 'Conturi bancare',
    personal: 'Personal',
    data: 'Date',
  },
  toasts: {
    pfaSaved: 'Datele PFA au fost salvate',
    personalSaved: 'Datele personale au fost salvate',
    invoiceNotesSaved: 'Mențiuni pe factură salvate',
    eFacturaSaved: 'Setările e-Factura au fost salvate',
    fiscalProfileSaved: 'Profilul fiscal a fost salvat',
    addressCopied: 'Adresă copiată în clipboard',
    addressCopyFailed: 'Nu am putut copia adresa',
    vatCodeAdded: 'Cod TVA intracomunitar adăugat',
    bankAdded: 'Cont bancar adăugat',
    bankNameRequired: 'Introdu denumirea băncii',
    bankAdvice:
      'Un cont bancar de PFA este recomandat pentru separarea finanțelor personale de cele profesionale.',
    passwordSimulated: 'Schimbare parolă — simulare (versiune locală)',
    cookiesSimulated: 'Gestionare cookies — simulare (versiune locală)',
  },
  pfaCard: {
    identity: 'Date de identificare',
    denumire: 'Denumire',
    cui: 'CUI',
    regCom: 'Număr registrul comerțului',
    adresa: 'Adresa',
    copy: 'Copiază',
    caen: 'Codurile tale CAEN',
    caenPrincipal: 'Principal',
    invoiceNotes: 'Mențiuni pe factură',
    invoiceNotesPlaceholder: 'Text afișat pe factura (opțional)',
    vatCode: 'Cod TVA intracomunitar',
    vatCodeAddedBadge: 'Adăugat',
    vatCodeAdd: 'Am cod TVA intracomunitar',
    vatCodeIntro:
      'Firmele neplătitoare de TVA care vor colabora cu firme din Uniunea Europeană au nevoie de acest cod special. Dacă ai deja un cod de TVA intracomunitar, te rugăm să îl introduci aici.',
  },
  eFactura: {
    connect: 'Conectare e-Factura',
    connected: 'Contul este conectat la platforma e-Factura',
    inProgress: 'În progres',
    preferences: 'Preferințe e-Factura',
    sending: 'Trimitere e-Factura',
    sendingHint: 'Alege cât de repede trimite aplicația; termenul legal rămâne același indiferent de alegere.',
    sendWithinTwoDays: 'În decurs de 2 zile de la emitere',
    sendAsap: 'Cât mai repede după emitere',
    contactData: 'Date de contact',
    contactOmitted: 'Nu sunt incluse în e-Factura',
    contactIncluded: 'Include e-mail și telefon în e-Factura',
    contactHint: 'Nu este obligatoriu să incluzi datele tale de contact în e-Factura.',
  },
  security: {
    title: 'Securitatea datelor personale',
    bankBody:
      'Pentru a efectua modificări ale conturilor bancare îți vom trimite un cod de securitate prin SMS.',
    personalBody:
      'Pentru modificări ale datelor personale îți vom trimite un cod de securitate prin SMS.',
  },
  bank: {
    title: 'Conturi bancare',
    add: 'Adaugă cont bancar',
    bank: 'Banca',
    currency: 'Moneda',
    empty: 'Niciun cont bancar înregistrat.',
    why: 'Îmi trebuie cont bancar de PFA?',
    bankPlaceholder: 'ex. CEC Bank',
  },
  personal: {
    card: 'Date personale',
    options: 'Opțiuni cont',
    changePassword: 'Schimbă parola',
    manageCookies: 'Gestionează cookies',
  },
  fiscal: {
    unsupported: 'Regim fiscal nesusținut',
    regimeNotComputable: (regime: string): string => `${regime} — nu poate fi calculat`,
    profile: 'Profil fiscal',
    regime: 'Regim fiscal',
    regimeHint: 'Un PFA nu poate alege impozit pe profit; temeiurile sunt în „Surse și note de interpretare”.',
    caen: 'Cod CAEN',
    caenHint: 'Codul CAEN nu schimbă regimul fiscal.',
    /**
     * PG-6b (B-29) — the declared activity family, and the three captions for it.
     *
     * The question is about the **method**, not about the trade: art. 68 alin. (1) excepts art. 68^1, 68^3
     * and 69 from the expense rules, so a person whose activity falls under one of those is not on the
     * sistem real this app computes. `research/30` §3 is why the field is asked rather than derived —
     * OMFP 925/2017 art. 2 alin. (4) keys the determination method to the activity description
     * „independent de codurile CAEN menționate cu titlu exemplificativ”, so the CAEN code two fields above
     * is expressly not an answer. The hint says that out loud because the field sits directly under the
     * CAEN field, and a form that asks the same question twice in different words teaches the person that
     * the second one was guessed from the first.
     */
    activityFamily: 'Familia de activități declarată',
    activityFamilyHint:
      'Faptă declarată de tine, nu dedusă din codul CAEN. Determină dacă regula de calcul este cea a cheltuielilor efective sau una pentru care acest pachet de reguli nu are calcul.',
    activityFamilyUnanswered:
      'Fără răspuns. Calculul de pe tabloul de bord folosește regulile cheltuielilor efective; dacă activitatea ta se impune prin altă metodă, aplicația semnalează că acest fapt lipsește în loc să ghicească.',
    activityFamilyOptions: {
      other: 'Altă activitate — cheltuieli efective (sistem real)',
      cazare: 'Prestare de servicii de cazare',
    },
    startYear: 'Anul începerii activității',
    fiscalYear: 'An fiscal de referință',
    establishmentDate: 'Data înființării (fracțiune de an)',
    establishmentDateHint:
      'Necompletat înseamnă un profil fără dată de înființare. Baza nu se proratează.',
    salaryStatus: 'Venit din salarii',
    salaryAmount: 'Venit brut anual din salarii (lei)',
    salaryAmountHint: 'Suma anuală este cea pe care se face testul de 6 salarii minime.',
    pensionerStatus: 'Calitate de pensionar',
    pensionerStatusHint:
      'Calitatea de pensionar este temei pentru CAS, nu pentru CASS; CASS se decide pe sumele primite ca pensie în anul fiscal.',
    pensionReceipt: 'Sume primite ca pensii în anul fiscal',
    pensionReceiptHint:
      'Excepția de la CASS se decide după sumele primite ca pensie în anul fiscal, nu după statutul de pensionar.',
    suspensionMonths: 'Luni cu pensia suspendată (anul fiscal)',
    suspensionPlaceholder: 'ex: 3,4',
    suspensionHint: 'Faptă consemnată, fără efect juridic cunoscut.',
    previousYearException: 'Excepție art. 154 alin. (1) lit. a), b), e) sau f) în anul precedent',
    previousYearExceptionHint:
      'Este o faptă din anul precedent și nu se deduce din calitatea de pensionar.',
    previousYearOption: 'Opțiune pentru CASS (art. 180 alin. (1)) în anul precedent',
    previousYearOptionHint: 'Este o faptă din anul precedent, nu a acestui an.',
    foreignInsurance: 'Asigurare de sănătate în alt stat (art. 153 alin. (2))',
    foreignInsuranceHint: 'Asigurarea trebuie și dovedită, nu doar declarată.',
    foreignInsuranceProof: 'Dovada asigurării din alt stat a fost făcută',
    foreignInsuranceProofHint: 'Fără dovadă, excepția nu produce nimic.',
    cassStatus: 'Asigurări sociale de sănătate',
    cassStatusHint:
      'Dintre cele trei valori, doar „Contribuția este datorată” este un temei confirmat pentru un PFA; celelalte două lasă linia de verificat și nu schimbă calculul.',
    cassStatusOptions: {
      obligatoriu: 'Contribuția este datorată',
      exempt: 'Exceptat (art. 154 alin. (1))',
      neplata: 'Nu se datorează',
    },
    vatExempt: 'Scutire de TVA',
    vatExceedanceDate: 'Data depășirii pragului de TVA',
    vatExceedanceDateHint:
      'Necompletat înseamnă că aplicația nu cunoaște data și nu afișează niciun termen de înregistrare.',
    cashFloor: 'Prag plăți în numerar (lei)',
  },
  vatModal: {
    title: 'Cod TVA intracomunitar',
    intro: 'Introdu codul unic de identificare fiscală obținut de la ANAF în scop de TVA intracomunitar',
    placeholder: 'RO123456789',
    search: 'Caută codul',
    add: 'Adaugă codul',
    validated: 'Cod validat (căutare simulată ANAF)',
  },
  /**
   * Phase 11 — the two controls that make demo data optional and stored data reversible.
   *
   * Before this phase there was no "start from scratch" path anywhere in the UI: the demo dataset was the
   * initial state, and the only way out was to delete each record by hand. Both controls are worded so
   * the consequence is stated before the click, and the destructive one names the preserved copy of a
   * rejected payload too — that copy is data as well, and "start from zero" has to mean zero.
   */
  data: {
    card: 'Datele aplicației',
    from: (origin: string): string => `Source of the data on screen: ${origin}`,
    originEmpty: 'Încă nu ai înregistrat nimic.',
    originPersisted: 'Datele de pe ecran sunt cele salvate pe acest dispozitiv.',
    originQuarantined: 'Copia salvată a fost respinsă la citire și păstrată; pe ecran nu ai nicio date.',
    originSandbox: 'Ceea ce vezi este sandboxul cu date de exemplu.',
    sandboxCard: 'Sandbox cu date de exemplu',
    sandboxBody:
      'Datele de exemplu nu se salvează, nu înlocuiesc datele tale și dispar la reîncărcare. Le poți elimina și de aici.',
    sandboxLoad: 'Încarcă datele de exemplu',
    sandboxUnload: 'Elimină sandboxul',
    dangerCard: 'Ștergere totală',
    dangerBody:
      'Se șterg toate datele inregistrate pe acest dispozitiv, inclusiv copia păstrată a unei sarcini respinse. Nu se poate anula.',
    dangerAction: 'Șterge toate datele și începe de la zero',
    confirmTitle: 'Sigur ștergi toate datele?',
    confirmBody:
      'Se elimină profilul, veniturile, cheltuielile, declarațiile, documentele, cursurile de schimb inregistrate și copia păstrată a unei sarcini respinse. Aplicația se întoarce la primul pas, fără nicio date.',
    confirmCancel: 'Nu șterg',
    confirmGo: 'Șterge tot',
  },
  dataToasts: {
    sandboxLoaded: 'Sandbox încărcat. Nu se salvează și nu ating datele tale.',
    sandboxUnloaded: 'Sandbox eliminat. Datele tale sunt exact cum erau.',
    allCleared: 'Toate datele au fost șterse. Începem de la zero.',
  },
} as const;
