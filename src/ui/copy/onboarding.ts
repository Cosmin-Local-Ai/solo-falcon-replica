/**
 * Phase 11 — the language of the first run.
 *
 * This is the screen a person sees when the app holds nothing they entered. It asks for the facts the
 * tax engine actually reads (see `domain/derived.ts`, the single normalisation point) and it says out loud
 * what it is deliberately NOT asking, so a short form is not mistaken for a complete profile.
 *
 * Three rules this module keeps:
 *  - **No estimate.** The refusal screen for `norma_venit` names the regime and stops. It shows no number,
 *    because the app holds no norm value and inventing one is the failure this project exists to prevent.
 *  - **No invented default.** Every optional field starts empty; an empty field stays unrecorded rather
 *    than becoming a `nu`.
 *  - **Deferred, not missing.** The activity declaration and the other-income amounts are owned by later
 *    phases (PG-6 / 12E / 12F). The screen says so instead of putting a placeholder in the profile.
 */
export const onboarding = {
  title: 'Bine ai venit',
  subtitle: 'Aplicația nu are încă nicio date înregistrată de tine. Începem cu profilul.',
  intro:
    'Îți punem câteva întrebări despre PFA-ul tău. Fără ele aplicația nu poate calcula nimic și nu inventează în locul tău.',
  demo: {
    question: 'Vrei mai întâi să vezi cum arată aplicația cu date de exemplu?',
    body:
      'Datele de exemplu sunt un sandbox: nu se salvează, dispar la reîncărcare și nu înlocuiesc datele tale reale.',
    action: 'Încarcă datele de exemplu',
  },

  sections: {
    identity: 'Cine ești',
    regime: 'Ce regim fiscal ai',
    activityFamily: 'Cum îți este impozitată activitatea',
    accommodation: 'Cazare: câte camere, și sub ce titlu intră venitul',
    start: 'Când ai început activitatea',
    vat: 'TVA',
    salary: 'Venit din salarii',
    pension: 'Pensie',
    other: 'Alte surse de venit',
    deferred: 'Ce nu întrebăm acum',
  },

  fields: {
    nume: 'Numele tău',
    numeHint: 'Apare în bara de sus și în documente.',
    cui: 'CUI',
    cuiHint: 'Opțional. Îl poți adăuga mai târziu din Setări.',
    cnp: 'CNP',
    cnpHint: 'Opțional. Se folosește doar la identificare, nu la niciun calcul.',
    regCom: 'Numărul de înregistrare la registrul comerțului',
    regComHint: 'Opțional. Un PFA se înregistrează la ONRC, dar aplicația nu are nevoie de acest număr ca să calculeze.',

    regime: 'Regimul fiscal al activității',
    regimeHint:
      'Alege varianta care corespunde activității tale. Dacă regimul nu este susținut, aplicația o spune înainte să calculeze ceva.',

    /**
     * PG-6b (B-29) — the activity-family question, asked rather than inferred.
     *
     * This is the fact the art. 68^3 refusal has been waiting for since the rule was written: the classifier
     * could match `activity_cazare` all along, and no caller ever supplied it, so an accommodation taxpayer
     * and a software consultant got the same confident figure. The hint states the two things a person
     * needs before answering: that the app will not read the answer off their CAEN code (OMFP 925/2017
     * art. 2 alin. (4) calls those code lists exemplary — „independent de codurile CAEN menționate cu titlu
     * exemplificativ”, research 30 §3), and what answering „Da” costs them today, which is no figure at all.
     */
    activityFamily:
      'Activitatea ta se impune prin altă metodă legală decât cheltuielile efective?',
    activityFamilyHint:
      'Aplicația nu citește răspunsul din codul CAEN: pentru lege listele de coduri sunt exemplificative, deci un cod nu spune cum e impozitată activitatea. Fără răspuns, calculul se face pe cheltuieli efective și aplicația semnalează că acest fapt lipsește. Dacă alegi prestarea de servicii de cazare, aplicația refuză calculul în loc să aplice unor venituri din cazare reguli care nu sunt ale lor — regimul forfetar de 30 % nu este încă implementat aici.',
    activityFamilyOptions: {
      other: 'Nu — cheltuieli efective (sistem real)',
      cazare: 'Da — prestare de servicii de cazare',
    },

    /**
     * PG-6h-2 (B-82, B-83, B-84) — the three accommodation questions, asked here and stored per year.
     *
     * These are shorter than the Settings versions on purpose: the copy guard fails a sentence spelled
     * twice, and the full legal framing lives once in `ui/copy/settings.ts`. What must stay in both places
     * is the shape of the answer — three questions, each starting unanswered, none of them filled in from a
     * CAEN code — because the onboarding form is where the likeliest accommodation taxpayer meets them
     * first, and `research/39` §1 is why they have to be asked rather than detected: a natural person
     * letting 1–7 rooms has no registered business activity and so no CAEN code to be read.
     */
    accommodationRooms: 'Câte camere închiriezi pe termen scurt în acest an fiscal?',
    accommodationRoomsHint:
      'Întrebarea nu pregătește o cifră: numărul alege titlul. Până la 7 camere inclusiv venitul intră în cedarea folosinței bunurilor (art. 83 alin. (2), art. 85), iar de la 8 camere în sus devine activitate independentă (art. 83 alin. (4), art. 68^3). Se răspunde pe an fiscal, pentru că art. 83 alin. (4) vorbește „începând cu anul fiscal în care”. Fără răspuns, aplicația nu alege niciun titlu.',
    accommodationEligibility: 'Structura ta este clasificată ca structură de primire turistică?',
    accommodationEligibilityHint:
      'art. 68^3 alin. (1) se adresează operatorilor economici definiti potrivit legislației turismului, iar acea clasificare nu se face în Codul fiscal. Aplicația înregistrează ce spui tu; nu o verifică și nu o decide ea.',
    accommodationEligibilityOptions: {
      da: 'Da',
      nu: 'Nu — închiriez camere din locuință proprietate personală',
    },
    accommodationCommission: 'Ce citire a art. 68^3 alin. (3) alegi pentru venitul tău brut?',
    accommodationCommissionHint:
      'Cele două lecturi ale aceluiași alineat nu se împacă prin nicio sursă primară, iar alegerea mișcă brutul, impozitul, baza de CASS și pragul de CAS. Aici nu există răspuns corect dat de aplicație: există răspunsul tău, consemnat ca atare, și celălalt rămâne vizibil în Setări.',
    accommodationCommissionOptions: {
      reading_a: 'Citește A — exclusarea merge doar prin alin. (12) / art. 83 alin. (4)',
      reading_b: 'Citește B — exclusarea se aplică la tot venitul din art. 68^3',
    },

    startDate: 'Data începerii activității',
    startDateHint:
      'Obligatorie. Format an-lună-zi, exemplu 2026-03-01. Fără această dată aplicația nu știe de când ești PFA.',

    vatRegistered: 'Ești înregistrat în scopuri de TVA?',
    vatRegisteredHint:
      'Scutirea de TVA și înregistrarea sunt două stări diferite; aplicația le tratează separat.',
    vatExceedanceDate: 'Data la care ai depășit pragul de TVA',
    vatExceedanceDateHint:
      'Opțional. Fără această dată aplicația nu afișează niciun termen de înregistrare și nu inventează unul.',

    salaryStatus: 'Ai și venit din salarii?',
    salaryAmount: 'Venitul brut anual din salarii',
    salaryAmountHint:
      'Suma anuală este cea pe care se face testul de 6 salarii minime; fără ea, partea de CASS rămâne de verificat.',

    pensionerStatus: 'Ai calitatea de pensionar?',
    pensionReceipt: 'Ai primit sume ca pensie în acest an fiscal?',
    pensionReceiptHint:
      'Calitatea de pensionar și sumele primite sunt fapte diferite; excepția de la CASS se decide după sumele primite.',

    // PG-6d (D-OTH-2, D-LEG-1): the five-checkbox list (`imobiliare`, `autovehicule`, `dividende`,
    // `concesiune`, `alte`) is gone, and with it the `otherIncomeOptions` copy keys. What is said here is
    // what the law actually asks — an amount per art. 155 alin. (1) lit. c)-h) category, per year.
    otherIncomeHint:
      'Legea nu întreabă dacă „ai alte venituri”, ci cât ai din fiecare categorie de la art. 155 alin. (1) lit. c)-h) din Codul fiscal: proprietate intelectuală, asocierea cu o persoană juridică, cedarea folosinței bunurilor, activități agricole, investiții și alte surse. Cei șase se adună într-un singur total, care alege o singură bază de calcul pentru CASS (art. 170 alin. (2)-(4)). Sumele se completează pe an fiscal, în Setări. Nu le întrebăm aici și nu le completăm noi: o categorie fără răspuns face suma necunoscută, iar aplicația refuză calculul în loc să pună zero. Fosta listă de bifă („imobiliare”, „autovehicule”, „dividende”, „concesiune”, „alte”) a fost eliminată — nu corespunde categoriilor legii, iar „concesiune” nu există în Codul fiscal.',
  },

  yes: 'Da',
  no: 'Nu',
  notRecorded: 'Nu răspund acum',

  deferred: {
    // PG-6b removed the activity declaration from this list: the family is asked now, on the screen above.
    // PG-6d removed the other-income flags: a checkbox cannot answer a question the law states in lei.
    intro: 'Un lucru nu se întreabă în acest pas, și nu este omis din greșeală:',
    otherAmounts:
      'Sumele pentru categoriile art. 155 alin. (1) lit. c)-h) din Codul fiscal se completează pe an fiscal, în Setări. Câtă vreme o categorie rămâne fără răspuns, cumularea de la art. 170 alin. (4) este necunoscută, iar aplicația refuză atât stabilirea bazei de CASS cât și exceptionea de la art. 174 alin. (7) lit. b) — nu completează zero.',
  },

  errors: {
    nameRequired: 'Scrie numele tău ca să putem continua.',
    startDateRequired: 'Data începerii activității este obligatorie.',
    finish: 'Nu am putut finaliza: verifică câmpurile marcate.',
    salaryAmountRequired:
      'Ai bifat venit din salarii, deci este nevoie și de suma anuală brută.',
    salaryAmountInvalid: 'Suma anuală din salarii nu este o valoare validă (lei, ≥ 0).',
  },

  refusal: {
    title: 'Acest regim nu este suportat',
    body: (regime: string): string =>
      `Regimul „${regime}” nu este suportat de acest pachet de reguli. Aplicația nu va calcula nimic pentru el.`,
    noEstimate:
      'Nu afișăm nicio estimare și nicio cifră de impozit pentru acest regim: aplicația nu deține valorile de care ar avea nevoie calculul, iar o cifră inventată ar fi mai gravă decât absența ei.',
    back: 'Mă întorc la alegerea regimului',
  },

  actions: {
    finish: 'Finalizează și deschide tabloul de bord',
  },

  toasts: {
    profileSaved: 'Profilul a fost salvat. Poți completa restul din Setări.',
    sandboxLoaded:
      'Sandbox încărcat: sunt date de exemplu, nu ale tale. Se elimină la reîncărcare sau din Setări.',
  },
} as const;
