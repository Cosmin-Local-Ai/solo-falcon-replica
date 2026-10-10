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

    otherIncome: 'Ai și alte surse de venit relevante?',
    otherIncomeHint:
      'Bifează ce ai. Se înregistrează doar faptul că sursa există — sumele nu se întreabă în acest pas.',
    otherIncomeOptions: {
      imobiliare: 'Venituri din chirii',
      autovehicule: 'Închiriere de autovehicule',
      dividende: 'Dividende',
      concesiune: 'Bunuri de concesiune',
      alte: 'Alte venituri',
    },
  },

  yes: 'Da',
  no: 'Nu',
  notRecorded: 'Nu răspund acum',

  deferred: {
    intro: 'Două lucruri nu se întreabă în acest pas, și nu sunt omise din greșeală:',
    activity:
      'Declararea activității pe coduri CAEN nu se colectează aici. Aplicația nu știe încă să lege un cod CAEN de o familie de activități, și o presupunere aici ar schimba modul de calcul.',
    otherAmounts:
      'Sumele pentru celelalte surse de venit nu se colectează aici. Se înregistrează doar că sursa există; câtă vreme lipsește cuantumul, calculul la care ar conta rămâne de verificat.',
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
