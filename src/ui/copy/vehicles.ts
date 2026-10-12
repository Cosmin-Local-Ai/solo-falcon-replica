/**
 * PG-6c (D-VEH-3) — the sentences about vehicles.
 *
 * One producer for the whole family, for the standing reason this repository treats a second producer as
 * a defect (B-70): the screen and the refusal must not end up describing the same rule in two sets of
 * words. The **legal** sentences that travel with a record — the two readings quoted inside a refusal
 * detail, the attribution sentence — are produced by `domain/fiscal/deductibility.ts` and are NOT
 * restated here.
 *
 * What the wording is not allowed to do, each of them a claim `docs/ai/research/40_vehicle_one_car_limit.md`
 * records as unsupported:
 *  - **name a car for the user.** No „the most expensive one”, no „the first registered”. The law supplies
 *    no selection criterion at all (§1), so the designation is asked for and recorded as the person's own
 *    choice (D-VEH-2).
 *  - **present the 50 % as a penalty.** Normele pct. 7 alin. (7) puts the burden only towards *full*
 *    deductibility („În vederea acordării deductibilității integrale … documente justificative **și**
 *    foaie de parcurs”), so 50 % is the statutory default when exclusive use is not evidenced (D-VEH-1).
 *  - **treat a leased or rented-in car as outside the rules.** alin. (7) lit. k) covers vehicles „aflate în
 *    **proprietate sau în folosință**”.
 *  - **claim an exception category is proven by a logbook.** Category membership follows from the nature of
 *    the activity; whether a *foaie de parcurs* is additionally required for income tax is UNKNOWN (§8.6),
 *    so the app asks and does not decide.
 *  - **mention depreciation.** lit. k) excludes amortisation from these rules and the art. 28 alin. (14)
 *    ceiling belongs to the fixed-asset phase; a sentence about it here would invite a reader to think one
 *    cap covers both.
 */

/** The five exception categories at art. 68 alin. (7) lit. k) pct. 1-5, keyed by the stored token. */
export const vehicles = {
  block: {
    label: 'Vehicule',
    intro:
      'Cheltuielile de funcționare, întreținere și reparații se limitează la 50 % pentru un vehicul care '
      + 'nu este folosit exclusiv în activitate (art. 68 alin. (7) lit. k)). Art. 68 alin. (5) lit. j) '
      + 'oprește aceste cheltuieli la „cel mult un singur autoturism aferent fiecărei persoane”, dar '
      + 'numai pentru autoturismele folosite de contribuabil sau de membrul asociat.',
    perPerson:
      'Limita este „aferentă fiecărei persoane”, nu registrului sau CUI-ului. Aplicația nu cunoaște '
      + 'decât o persoană: dacă deții în același timp și un II/IF, legea nu spune dacă ai dreptul la un '
      + 'autoturism pentru fiecare, și aplicația nu alege în locul tău.',
    ownership:
      'Sunt vizate și mașinile luate în chirie sau în leasing: art. 68 alin. (7) lit. k) vorbește despre '
      + 'vehiculele „aflate în proprietate sau în folosință”. Nu există o excepție pentru parcul unei '
      + 'companii de leasing la impozitul pe venit.',
    add: 'Adaugă un vehicul',
    labelField: 'Cum îl numești',
    labelPlaceholder: 'de exemplu: Loganul albastru',
    plateField: 'Număr de înmatriculare',
    plateOptional: 'opțional',
    remove: 'Șterge vehiculul',
    empty: 'Nu ai înregistrat niciun vehicul. Cât timp lista e goală, cheltuielile de vehicul rămân la '
      + 'regula generală de 50 % din art. 68 alin. (7) lit. k).',
    yearNote: 'Faptele se declară pe an fiscal. Un an fără niciun răspuns rămâne fără răspuns.',
  },

  facts: {
    yes: 'da',
    no: 'nu',
    usedByPerson: 'Este folosită de tine (contribuabil) sau de un membru asociat?',
    usedByPersonHint:
      'Întrebarea decide dacă mașina intră sub limita de „un singur autoturism”. Art. 68 alin. (5) '
      + 'lit. j) este limitată prin propriile cuvinte la „autoturismele folosite de contribuabil sau '
      + 'membru asociat”: o mașină folosită doar în activitate, doar de angajați sau doar într-una '
      + 'dintre categoriile de excepție rămâne în afara limitei și se deduce după regula generală.',
    usedByPersonUnanswered:
      'Fără acest răspuns aplicația numără mașina drept posibilă în interiorul limitei și nu alege ea '
      + 'care autoturism primește dreptul.',

    use: 'Cum este folosită în activitate?',
    useOptions: {
      exclusive: 'Exclusiv în activitate, cu documente și foaie de parcurs',
      mixed: 'Și în activitate, și în afara ei',
      not_used: 'Deloc în activitate',
      unknown: 'Nu știu / nu am documentat',
    },
    useHint:
      'Deductibilitatea integrală cere documente justificative și o foaie de parcurs cu cel puțin: '
      + 'categoria vehiculului, scopul și locul deplasării, kilometrii parcurși, norma proprie de consum '
      + 'de carburant pe kilometru (Normele HG 1/2016 pct. 7 alin. (7)).',
    useUnanswered:
      'Legea nu lasă această situație deschisă: fără dovada utilizării exclusive, deducerea este 50 %. '
      + 'Dacă ții o foaie de parcurs, răspunsul se poate schimba.',

    exception: 'Categorie de excepție invocată (art. 68 alin. (7) lit. k) pct. 1-5)',
    exceptionOptions: {
      none: 'Niciuna',
      urgenta_paza_curierat: 'Urgență, pază și protecție, curierat',
      agent_vanzari_achizitii: 'Agenți de vânzări și de achiziții',
      transport_persoane_cu_plata: 'Transport de persoane cu plată, inclusiv taximetrie',
      servicii_plata_inchiriere_instruire: 'Servicii cu plată, inclusiv închiriere sau instruire în școlile de șoferi',
      marfuri_in_scop_comercial: 'Vehicul folosit ca marfă în scop comercial',
    },
    exceptionHint:
      'Categoria se invocă, nu se deduce: ea rezultă din natura activității, iar sarcina probei cade '
      + 'asupra contribuabilului. Dacă păstrezi sau nu o foaie de parcurs pentru aceste categorii la '
      + 'impozitul pe venit nu este stabilit în nicio sursă primară, și aplicația nu decide în locul '
      + 'nimănui.',

    designation: 'Care autoturism primește dreptul de deducere a cheltuielilor de funcționare?',
    designationHint:
      'Alegea este a ta, nu a aplicației. Nici Codul fiscal, nici Normele nu spun care autoturism este '
      + 'acela când persoana folosește două sau mai multe; nu există „cea mai scumpă” sau „prima '
      + 'înmatriculată”. Ce se întâmplă cu celălalt autoturism rămâne nehotărât, și aplicația raportează '
      + 'ambele lecturi în loc să aplice una.',
    designationUnanswered:
      'Niciun autoturism desemnat. Cheltuielile de funcționare ale mașinilor care intră sub limită rămân '
      + 'în afara calculului până când alegi unul.',
  },

  /** What the app concluded for one car, per fiscal year. Never a verdict about the other car. */
  status: {
    outside_cap: 'În afara limitei de un autoturism: nu este declarată ca fiind folosită de contribuabil '
      + 'sau de membru asociat. Regula generală se aplică: 100 % cu utilizare exclusivă dovedită, altfel 50 %.',
    sole_candidate: 'Singura mașină care poate intra sub limită, deci dreptul se aplică fără nicio alegere.',
    designated: 'Desemnată de tine pentru dreptul de deducere (art. 68 alin. (5) lit. j)).',
    not_designated: 'Nu este autoturismul desemnat. Cheltuielile ei de funcționare rămân în afara '
      + 'calculului, cu ambele lecturi arătate — nu sunt o cheltuială rezolvată.',
    designation_missing: 'Pentru acest an există două sau mai multe mașini care pot intra sub limită și '
      + 'niciuna nu este desemnată. Aplicația nu alege niciuna.',
    designation_conflict: 'Ai desemnat mai mult de un autoturism pentru acest an, iar litera permite '
      + 'unul singur. Aplicația nu alege între ele.',
  },

  expense: {
    field: 'Vehiculul căruia îi aparține cheltuiala',
    none: '— niciun vehicul —',
    bannerTitle: 'Cheltuieli de vehicul pe care aplicația nu le-a putut decide',
    bannerTail:
      'Nu sunt cheltuieli rezolvate. Aplicația le-a scos din calcul pentru că nu știe cărui vehicul i se '
      + 'aplică sau pentru că limita de un autoturism nu este stabilită pentru acest an, și arată ambele '
      + 'lecturi în loc să aplice una.',
    hint:
      'Atribuie cheltuiala unei mașini ca să i se aplice faptele acelei mașini. Aplicația nu ghicește '
      + 'vehiculul după furnizor, după categoria de cheltuială sau după codul CAEN.',
    unattributed:
      'Cheltuială de vehicul neatribuită: nu se știe cărui vehicul i se aplică, așa că nu este clasificată '
      + 'după faptele altui vehicul.',
    rowLabel: 'Vehicul',
    defaultNote:
      '50 % din această cheltuială intră în calcul: utilizarea exclusivă în activitate nu este dovedită, '
      + 'iar legea aplică acest procent în mod implicit, nu ca sancțiune.',
  },
};
