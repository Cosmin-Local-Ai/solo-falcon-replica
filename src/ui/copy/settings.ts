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

import type { VatRegistrationStatus } from '../../domain/fiscal/vat';

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
    // B-124 — the card used to print `caen?.[0]` under a lone „Principal" badge and hide the rest
    // of the list. The role captions now live with the control that edits them
    // (`fiscal.caenRolePrincipal` / `caenRoleSecondary`), so they are not spelled twice here.
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
    // B-124 — „Cod CAEN" (singular) is gone: the model was always a list and the label said
    // otherwise. `caenClasses` is the caption of the control that edits all five.
    caenHint: 'Codul CAEN nu schimbă regimul fiscal.',
    /**
     * Step 11 / B-124 — the CAEN control.
     *
     * The defect this copy belongs to: `identity.caen` is a **list** and the field was a **single
     * input** that read `caen?.[0]?.cod`. A person with a principal class and secondary classes
     * could not enter the secondary ones at all, and could not see that the app had silently kept
     * them.
     *
     * Three rules these strings obey:
     *
     * - **The cap carries its citation.** „Cel mult 5" is OUG 44/2008 art. 16 alin. (1); without
     *   the article on the control, „4" reads as an arbitrary product decision. And the cap is on
     *   the **total**, not on a category called „secundară" — the wording must not imply a quota.
     * - **A code is chosen, not typed.** Free text is not a CAEN, so the empty-result sentence has
     *   to say what a valid one looks like.
     * - **The classification creates nothing.** HG 656/1997 art. 4 alin. (1): „încadrarea … nu
     *   presupune crearea de drepturi sau obligații". The hint says so exactly where the person is
     *   about to conclude the opposite.
     */
    caenClasses: 'Clasele CAEN din obiectul de activitate',
    caenClassesIntro:
      'Clasa principală este cea din cererea ONRC; restul sunt clasele din anexă. Alege-le din nomenclator — nu se pot scrie de mână.',
    caenRolePrincipal: 'Principală',
    caenRoleSecondary: (n: number): string => `Secundară ${n}`,
    caenAdd: 'Adaugă încă o clasă',
    caenRemove: 'Elimină clasa',
    caenSearchPlaceholder: 'Caută după cod (47) sau după denumire (cazare)',
    caenNoResults:
      'Nicio clasă CAEN Rev.3 nu corespunde. Caută după codul de 4 cifre sau după un cuvânt din denumire — o denumire scrisă de mână nu este un cod CAEN.',
    caenOnlyClass:
      'Se poate alege doar o clasă, adică un cod de 4 cifre. Diviziunile (2 cifre) și grupele (3 cifre) apar în listă doar ca să vezi sub ce se află clasa.',
    caenCapReached:
      'S-au atins cele 5 clase. Nu se mai poate adăuga a șasea — limita este a totalului de clase din obiectul de activitate, nu a celor secundare.',
    caenCapCitation:
      'OUG 44/2008 art. 16 alin. (1) — „PFA poate avea în obiectul de activitate cel mult 5 clase de activități prevăzute de codul CAEN". La SRL obiectele secundare nu sunt limitate; la PFA nu.',
    caenCounter: (used: number, max: number): string => `${used} din ${max} clase folosite`,
    caenNotRev3:
      'Codul salvat nu există în CAEN Rev.3. A fost păstrat așa cum este, ca să nu se piardă o date; alege o clasă din listă ca să o înlocuiești.',
    caenAttribution: 'Sursă: clasificarea INS — Ordinul președintelui INS nr. 377/2024, MO I 385/25.04.2024, în vigoare de la 1 ianuarie 2025.',
    caenDoesNotSetTax:
      'Nicio sumă din aplicație nu se calculează din aceste coduri. HG 656/1997 art. 4 alin. (1): încadrarea „nu presupune crearea de drepturi sau obligații”.',
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
      'Fapt declarat de tine, nu dedus din codul CAEN. Determină dacă regula de calcul este cea a cheltuielilor efective sau una pentru care acest pachet de reguli nu are încă calcul.',
    activityFamilyUnanswered:
      'Fără răspuns. Calculul de pe tabloul de bord folosește regulile cheltuielilor efective; dacă activitatea ta se impune prin altă metodă, aplicația semnalează că acest fapt lipsește în loc să ghicească.',
    activityFamilyOptions: {
      other: 'Altă activitate — cheltuieli efective (sistem real)',
      cazare: 'Prestare de servicii de cazare',
    },
    /**
     * PG-6h-2 (B-82, B-83, B-84) — the accommodation facts, and the title they decide.
     *
     * Three rules these strings obey:
     *
     * - **The count is a category switch, never a quantity.** The hint says the count decides *under which
     *   title* the income falls, because that is what art. 83 alin. (2) and art. 83 alin. (4) actually do.
     *   No sentence here may imply the number feeds a calculation.
     * - **The 7 in the fiscal rule is not the 7 in the tourism norms.** Ordin 65/2013 alin. (12) caps a
     *   natural person's right to *request tourism classification* at „7 camere/14 locuri”; art. 83 alin.
     *   (4) sets the fiscal boundary at „peste 7 camere”. `research/39` §3 keeps them apart, and so does
     *   this copy — the eligibility question never quotes the classification ceiling as a tax rule.
     * - **A CAEN code may prompt, never answer.** The prompt note says out loud that the list is this app's
     *   own choice, citing HG 656/1997 art. 4 alin. (1)-(2), because `research/39` §3 found no official
     *   CAEN ↔ tourism-structure mapping in any source. A form that asks a question because of a code, and
     *   says the code is not the answer, is the difference between a prompt and an inference.
     */
    // ── B-105 — the ordinary *cedarea folosinței bunurilor* facts ──────────────────────────────
    //
    // Three facts, and each one moves a legal outcome by itself, which is why none of them may arrive
    // pre-filled. The tenant's legal nature decides between art. 84 and art. 84^1, and with it who computes
    // the tax, whether it is final, and whether a Declarația Unică is owed for the income. Whether the tenant
    // paid the owner's costs changes the gross the 20 % ratio runs over. Whether the rent was paid in kind,
    // or a guarantee was applied to it, switches the withholding off and puts the whole duty back on the
    // owner. A default for any of them is not a missing value — it is a different taxpayer.
    leaseSection: 'Închiriere obișnuită (cedarea folosinței bunurilor): cine plătește și ce anume plătește',
    leaseTenantNature: 'Cine îți plătește chiria?',
    leaseTenantNatureOptions: {
      persoana_fizica: 'O persoană fizică (fără obligația de a ține evidență contabilă)',
      entitate_cu_evidenta_contabila: 'O persoană juridică sau altă entitate cu obligația de a ține evidență contabilă',
    },
    leaseTenantNatureHint:
      'Faptul care alege regimul este chiriașul, nu proprietarul. art. 84 alin. (1) din Codul fiscal se adresează veniturilor „altele decât veniturile plătite de persoane juridice sau alte entități care au obligația de a conduce evidență contabilă”, iar art. 84^1 ia exact acea populație scoasă și îi dă un regim de reținere la sursă. Cu un chiriaș persoană fizică impozitul și-l stabilești singur și nu este impozit final; cu un chiriaș care ține evidență contabilă impozitul de 10 % se reține la momentul plății și este impozit final.',
    leaseTenantNatureUnanswered:
      'Fără răspuns. Aplicația nu alege regimul în locul tău și nu îl ghicește din CUI-ul din registru, din numele chiriașului sau dintr-o valoare implicită; cât timp lipsește, venitul se calculează în sistem real, iar regula care ar fi trebuit aplicată rămâne consemnată ca faptă care lipsește.',
    leaseRegimeApplied: {
      persoana_fizica:
        'Regimul pe care aplicația îl va folosi: art. 84 — venitul brut este chiria prevăzută în contract pentru anul fiscal, indiferent de momentul încasării; cheltuieli forfetare 20 %; impozit de 10 % din venitul net, stabilit de tine și nevătămând ca impozit final (art. 123 alin. (2)).',
      entitate_cu_evidenta_contabila:
        'Regimul pe care aplicația îl va folosi: art. 84^1 — venitul net se stabilește la fiecare plată, impozitul de 10 % se reține la sursă de chiriaș și este impozit final (art. 84^1 alin. (5)-(6)). Pe Declarația Unică rămân contribuțiile sociale: art. 122 alin. (6) lit. a) scutește declarația numai pentru impozitul pe venit, iar pe chiria obișnuită CASS nu se reține la sursă.',
    },
    leaseContractRent: 'Chiria prevăzută în contract pentru acest an fiscal (lei)',
    leaseContractRentHint:
      'art. 84 alin. (2) măsoară venitul brut „pe baza chiriei prevăzute în contract pentru fiecare an fiscal, indiferent de momentul încasării chiriei”. Se declară chiria anului, nu încasările anului: sunt două mărimi diferite și la 31 decembrie dau același total, în rest nu. Dacă lași câmpul gol, aplicația adună documentele înregistrate pentru acest an și spune că asta a făcut; dacă declarai o sumă și documentele dau alta, aplicația refuză în loc să aleagă.',
    leaseOwnerCosts: 'Cheltuieli care cad în sarcina proprietarului, dar plătite de chiriaș (lei)',
    leaseOwnerCostsHint:
      'art. 84 alin. (1) ultima propoziție: venitul brut se majorează cu cheltuielile care cad în sarcina proprietarului și sunt efectuate de cealaltă parte contractantă. Ele nu sunt în registrul tău — chiriașul le-a plătit — deci numai tu le poți declara. Se adaugă la brut ÎNAINTE de cota forfetară de 20 %, pentru că cota este procent din brut; ordinea schimbă netul.',
    leaseInKind: 'Chiria se plătește exclusiv în natură?',
    leaseGuarantee: 'O garanție contractuală a fost folosită pentru plata chiriei?',
    leaseAlin8Hint:
      'art. 84^1 alin. (8): când venitul brut se plătește exclusiv în natură, sau o garanție contractuală este utilizată pentru plata chiriei, reținerea la sursă nu se aplică — îți determini singur venitul net, îți calculezi impozitul și depui Declarația Unică până la termenul din art. 122 alin. (3). Este o excepție prevăzută de lege, nu o situație de margine.',
    leaseContractDate: 'Data încheierii contractului de locațiune',
    leaseContractDateHint:
      'art. 83 alin. (5): contractul de locațiune și modificările ulterioare se înregistrează la organul fiscal competent în termen de cel mult 30 de zile. Termenul pornește de la contract, deci fără data lui aplicația nu poate fixa termenul — îl raportează ca nedefinit, nu ca împlinit. Obligația nu dispare pentru că chiriașul este persoană juridică; sunt scutite numai arendarea și închirierea pe termen scurt a camerelor în locuințe proprietate personală.',
    leaseRegistered: 'Ai înregistrat contractul la organul fiscal?',
    leaseRegisteredHint:
      'Se înregistrează cu formularul „Cerere de înregistrare a contractelor de locațiune”, cod C168 — instituit prin OPANAF 114/2019 și modificat prin OPANAF 2031/2022 și OPANAF 161/2025. Codul fiscal nu numește niciun formular: obligația este în lege, formularul este în ordinul ANAF, și cele două se citează separat. Aplicația înregistrează răspunsul tău despre depunere, nu îl verifică.',

    accommodationSection: 'Cazare: câte camere și sub ce titlu intră venitul',
    accommodationRooms: 'Numărul de camere închiriate pe termen scurt, pentru anul fiscal de mai sus',
    accommodationRoomsHint:
      'Numărul hotărăște sub ce titlu intră venitul, nu cât de mare este o cifră: 1–7 camere înseamnă cedarea folosinței bunurilor (art. 83 alin. (2), art. 85 din Codul fiscal), peste 7 camere înseamnă activitate independentă (art. 83 alin. (4), art. 68^3). Se înregistrează pe an fiscal, pentru că art. 83 alin. (4) vorbește „începând cu anul fiscal în care”. Nu este numărul de camere din normele de turism — cele două reguli de 7 au autori și efecte diferite.',
    accommodationRoomsUnanswered:
      'Fără răspuns. Aplicația nu alege un titlu în locul tău și nu completează numărul din codul CAEN, din sumele din registru sau dintr-o valoare implicită; cât timp lipsește, calculul pentru cazare rămâne oprit.',
    accommodationEligibility: 'Ești operator economic definit potrivit legislației turismului?',
    accommodationEligibilityHint:
      'art. 68^3 alin. (1) se adresează „operatorilor economici definiți potrivit legislației specifice domeniului turismului”. Cine este unul se hotărăște în legea turismului și în autorizația de la registrul comerțului, nu în Codul fiscal: aplicația înregistrează răspunsul tău, nu îl verifică și nu îl decide.',
    accommodationEligibilityOptions: {
      da: 'Da — structura mea este clasificată ca structură de primire turistică',
      nu: 'Nu — închiriez camere dintr-o locuință proprietate personală',
    },
    accommodationCommission: 'Ce citire a art. 68^3 alin. (3) se aplică la venitul tău brut?',
    accommodationCommissionHint:
      'alin. (3) scoate din venitul brut comisionul reținut de entitățile care facilitează închirierea pe termen scurt a camerelor situate în locuințe proprietate personală, dar textul stă într-un articol al cărui subiect la alin. (1) este spațiul unui operator economic din turism. Nicio sursă primară nu împacă cele două lecturi, iar alegerea schimbă brutul, deci impozitul, baza de CASS și pragul de CAS. Aceasta este alegerea ta, consemnată ca atare — nu o concluzie la care a ajuns aplicația.',
    accommodationCommissionOptions: {
      reading_a: 'Citește A — exclusarea operează doar prin alin. (12) / art. 83 alin. (4)',
      reading_b: 'Citește B — exclusarea este o regulă generală de stabilire a brutului',
    },
    /**
     * Which reading the app applied, and the alternative kept visible. D-COM-1 asks for both halves: a
     * choice shown without its alternative reads like a finding, and a choice shown with it reads like a
     * choice.
     */
    accommodationCommissionApplied: {
      reading_a:
        'Aplicația folosește citirea A, pentru că așa ai ales tu: comisionul nu este scos din brut decât acolo unde alin. (12) și art. 83 alin. (4) îl scot. Cealaltă citire posibilă, B, ar scoate comisionul din brut pentru tot venitul din art. 68^3 — și ar schimba brutul, impozitul, baza de CASS și pragul de CAS.',
      reading_b:
        'Aplicația folosește citirea B, pentru că așa ai ales tu: comisionul este scos din brut pentru tot venitul din art. 68^3. Cealaltă citire posibilă, A, ar lăsa brutul integral acolo unde alin. (12) și art. 83 alin. (4) nu îl reduc — și ar schimba brutul, impozitul, baza de CASS și pragul de CAS.',
    },
    accommodationCommissionUnanswered:
      'Fără răspuns. Aplicația nu alege nicio citire: niciuna nu este stabilită de Codul fiscal, iar a alege una ar mișca venitul brut, impozitul, baza de CASS și pragul de CAS.',

    /**
     * PG-6d (D-OTH-1, D-OTH-2, B-41) — the six CF art. 155 alin. (1) lit. c)-h) categories, per fiscal
     * year. Three things every sentence here has to carry, and the old flag UI carried none of them: the
     * figure asked for is the one art. 170 alin. (4) measures (net for four of the six, BRUT for „alte
     * surse”), an empty box is not zero, and the six sum into ONE base for the whole person, not into six
     * contributions.
     */
    ladderSection: 'Celelalte venituri ale persoanei fizice: șase sume, pe anul fiscal de mai sus',
    ladderIntro:
      'Sunt categoriile art. 155 alin. (1) lit. c)-h) din Codul fiscal. Cele șase sume se adună într-un singur total, iar totalul alege o singură bază de calcul pentru CASS: sub 6 salarii minime brute cumulate nu se datorează deloc CASS pe aceste venituri, la 6 SM baza este 6 SM, la 12 SM sare la 12 SM, la 24 SM sare la 24 SM (art. 170 alin. (2)-(4), art. 174¹ alin. (1)). Este o prăpastie, nu o cotă progresivă, și este o singură bază pentru toată persoana, nu câte una per categorie — la fel cum subsecțiunea 2.2 din Declarația Unică are șase rânduri și un singur total.',
    ladderAmounts: {
      proprietateIntelectuala: 'Drepturi de proprietate intelectuală — venitul net (art. 155 alin. (1) lit. c))',
      asocierePersoanaJuridica: 'Asocierea cu o persoană juridică — venitul net distribuit (lit. d), art. 125 alin. (8)-(9))',
      cedareaFolosinteiBunurilor: 'Cedarea folosinței bunurilor — venitul net (lit. e), art. 84-85)',
      activitatiAgricole: 'Activități agricole, silvicultură și piscicultură — venitul net SAU norma de venit (lit. f), art. 104-106)',
      investitii: 'Investiții — venitul și/sau câștigul net (lit. g), art. 94-97)',
      alteSurse: 'Alte surse — VENITUL BRUT (lit. h), art. 114-116)',
    },
    ladderAmountHints: {
      proprietateIntelectuala:
        'Suma pe care o cere legea este venitul NET, după cheltuiala forfetară de la art. 72 / 72¹ sau venitul net potrivit art. 73 — nu încasarea brută. Aplicația nu calcă forfetarul în locul tău: întreabă suma pe care legea o măsoară.',
      asocierePersoanaJuridica:
        'Venitul net distribuit din asocierea cu o persoană juridică, potrivit art. 125 alin. (8)-(9) din Codul fiscal.',
      cedareaFolosinteiBunurilor:
        'Venitul NET: brut minus cheltuiala forfetară de 20 % (art. 84 alin. (3)), sau de 30 % pentru camerele 1–7 închiriate pe termen scurt (art. 85 alin. (2), nou din 2026). Din 2026 nu mai există normă de venit pentru închirieri — sintagmele „sau norma de venit, după caz” au fost șterse prin Legea 239/2025 art. XII pct. 19.',
      activitatiAgricole:
        'Aici, și numai aici, mai supraviețuiește norma de venit: art. 170 alin. (4) lit. e) spune „venitul net sau norma de venit, după caz”. Spune ce fel de sumă ai scris.',
      investitii:
        'Venitul sau câștigul net potrivit art. 94-97. Pentru dividende suma nu este distribuția brută: art. 170 alin. (4) lit. d) ia în calcul „dividendele plătite, diminuate cu impozitul reținut”. Dividendele ajung la CASS numai pe această cale — nu există o literă proprie pentru ele la art. 155 alin. (1).',
      alteSurse:
        'Singularitatea acestei categorii: art. 170 alin. (4) lit. f) măsoară aici VENITUL BRUT, nu netul. Și numai aici. Mai important: „alte surse” înseamnă art. 114, adică veniturile care nu se încadrează în art. 61 lit. a)-h). Premiile și jocurile de noroc (art. 61 lit. g)) și transferul proprietăților imobiliare (art. 61 lit. h)) nu apar în art. 155 alin. (1) și nu atrag niciodată CASS — o categorie „alte” nesemnalată ar fabrica o datorie.',
    },
    ladderAgricoleBaza: 'Suma de la activități agricole este…',
    ladderAgricoleBazaOptions: {
      venit_net: '…venit net (art. 104-106)',
      norma_de_venit: '…normă de venit — art. 170 alin. (4) lit. e): „venitul net sau norma de venit, după caz”',
    },
    ladderInvestitiiBaza: 'Suma de la investiții este…',
    ladderInvestitiiBazaOptions: {
      castig_net: '…câștig / venit net potrivit art. 94-97',
      dividende_platite_diminuate_cu_impozitul_retinut: '…dividende plătite, diminuate cu impozitul reținut',
    },
    ladderCedareSursa: 'De unde vin veniturile din închiriere?',
    ladderCedareSursaHint:
      'Aceasta este întrebarea care decide litera, nu o etichetă de contract. art. 83 alin. (1) exclude în mod expres veniturile din activități independente: dacă închirierea este activitatea proprie a PFA, încasările sunt art. 67 alin. (1) — art. 155 alin. (1) lit. b), care au altă cale de contribuție (art. 170 alin. (1), cu plafon de 72 SM) și NU intră în cumularea de aici. Dacă dai în folosință un bun din patrimoniul personal, sunt lit. e). Nu există o categorie „concesiune” în Codul fiscal: căutată în tot codul, „venituri din concesiune” nu are nicio apariție.',
    ladderCedareSursaOptions: {
      activitate_proprie_a_pfa: 'Din activitatea proprie a PFA (art. 67 alin. (1))',
      patrimoniu_personal: 'Din cedarea unui bun din patrimoniul personal (art. 83 alin. (1))',
    },
    ladderAlteSurseArt114: 'Suma de la „alte surse” este un venit definit la art. 114?',
    ladderAlteSurseArt114Options: {
      da: 'Da — este un venit care nu se încadrează în art. 61 lit. a)-h)',
      nu: 'Nu — este din jocuri de noroc sau din transferul proprietăților imobiliare',
    },
    ladderAlteSurseArt114Hint:
      'Fără acest răspuns aplicația nu cumulează suma: art. 155 alin. (1) lit. h) trimite la art. 114, iar art. 61 lit. g) și lit. h) nu atrag CASS deloc. Un „alte” fără calificare fabrică o contribuție.',
    ladderNeimpozabil: 'Sume neimpozabile consemnate (art. 93 și 105)',
    ladderNeimpozabilHint:
      'art. 170 alin. (5): „La încadrarea în plafonul prevăzut la alin. (4) nu se iau în calcul veniturile neimpozabile, prevăzute la art. 93 și 105.” Aplicația le înregistrează ca sumă pe care NU o adună — și le arată tocmai pentru că ele despart cele două lecturi ale art. 174 alin. (7) lit. b).',
    ladderCassRetinut: 'CASS reținută la sursă de plătitorii tăi (art. 174¹ alin. (3)-(7))',
    ladderCassRetinutHint:
      'Se deduce din contribuția datorată (art. 174¹ alin. (6), rd. 6 din subsecțiunea 2.2 a Declarației Unice), nu se adaugă la ea. Suma pe care o scrii aici este cea din informarea pe care plătitorul de venit are obligația s-o emită (art. 174¹ alin. (7)); dacă o lași liberă, aplicația o derivă din cuantumul declarat al sursei, potrivit pragului de 6 salarii minime brute din alin. (3) — și raportează zero doar atunci când alin. (8) spune chiar că nimeni nu reține. Dacă suma declarată nu coincide cu cea derivată, ambele se afișează și neconcordanța se semnalează: aplicația nu repară niciuna.',
    ladderShortNames: {
      proprietateIntelectuala: 'proprietate intelectuală',
      asocierePersoanaJuridica: 'asocierea cu o persoană juridică',
      cedareaFolosinteiBunurilor: 'cedarea folosinței bunurilor',
      activitatiAgricole: 'activități agricole',
      investitii: 'investiții',
      alteSurse: 'alte surse',
    },
    ladderAnswered: (answered: number, missing: string) =>
      `Ai răspuns la ${answered} din cele șase categorii. ${
        answered === 6
          ? 'Cumularea de la art. 170 alin. (4) se poate face.'
          : `Lipsesc: ${missing}. Cumularea se face peste TOATE șase, deci câtă vreme una lipsește, baza nu se calculează — aplicația nu completează zero.`
      }`,
    ladderUnasked:
      'Niciuna dintre cele șase categorii nu este completată pentru acest an. Aplicația nu calculează nicio bază și nu susține că nu ai avut astfel de venituri: întrebarea pur și simplu nu a primit răspuns.',
    ladderZeroIsAFact:
      'O categorie lăsată liberă nu este zero. Zero este o sumă declarată — scrie 0 dacă așa stau lucrurile. Diferența este tocmai defectul pe care această secțiune îl închide: o categorie fără răspuns face suma necunoscută, iar o sumă necunoscută poate însemna fie o datorie inventată, fie una ștearsă.',
    /**
     * The title the recorded count puts this year's income under. One sentence per state, including the
     * state where nothing is recorded — the third one is the one acceptance 1 asks for, and a form that
     * leaves it blank teaches the person that an unanswered question still has a title.
     */
    accommodationTitleCedarea: (year: number): string =>
      `Pentru ${year} venitul înregistrat este sub titlul „cedarea folosinței bunurilor”: art. 83 alin. (2) și art. 85 din Codul fiscal. Nu este activitate independentă, iar metoda forfetară din art. 68^3 nu i se aplică. Pentru acest titlu aplicația aplică regula lui art. 85: brutul cât sumele încasate în an, cheltuială forfetară 30 %, impozit 10 % din net și impozit final (art. 85 alin. (2) și (6)), iar CASS se alege din treptele de 6 / 12 / 24 de salarii minime (art. 170 alin. (2)-(4)), nu din net. Celelalte venituri din cedarea folosinței rămân la 20 % — art. 84 alin. (3).`,
    accommodationTitleIndependent: (year: number): string =>
      `Pentru ${year} venitul înregistrat este sub titlul „activitate independentă”: art. 83 alin. (4) și art. 68^3 din Codul fiscal, pentru că numărul de camere este peste 7.`,
    accommodationTitleUnknown: (year: number): string =>
      `Pentru ${year} numărul de camere nu este înregistrat, deci aplicația nu știe sub ce titlu intră venitul. Nu alege niciunul: 1–7 camere și peste 7 camere sunt titluri diferite, nu două valori ale aceluiași calcul.`,
    accommodationCaenPromptHint:
      'Întrebările despre cazare apar aici și pentru că profilul are un cod CAEN din Divizia 55. Codul nu este un răspuns la niciuna dintre ele: HG 656/1997 art. 4 alin. (1) spune că încadrarea într-o entitate CAEN „nu presupune crearea de drepturi sau obligații”, iar alin. (2) lasă responsabilitatea folosirii lui la autoritatea care o folosește. Lista de coduri după care se afișează aceste întrebări este o alegere a acestei aplicații, nu o lege — nicio listă oficială de corespondență între tipul de structură turistică și codurile CAEN nu a fost găsită.',
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
    // PG-6f (B-30) — replaces the retired `vatExempt` yes/no. The law does not ask whether a person is
    // „exempt”; it places them in one of six registration states, and the answer decides both the money
    // measure of every record and whether any input VAT may be claimed at all.
    vatRegistration: 'Starea de înregistrare în scopuri de TVA',
    vatRegistrationUnanswered: 'Nu este înregistrată — aplicația nu a întrebat',
    vatRegistrationOptions: {
      scutit_art310: 'Scutit de TVA (art. 310)',
      inregistrat_art316: 'Înregistrat în scopuri de TVA (art. 316)',
      inregistrare_voluntara: 'Înregistrare voluntară, sub plafon (art. 316 alin. (1) lit. a) pct. 2)',
      plafon_depasit: 'Înregistrat din depășirea plafonului (art. 316 alin. (1) lit. b))',
      inregistrare_anulata: 'Codul de TVA a fost anulat (art. 316 alin. (11))',
      reinregistrat: 'Reînregistrat după anulare (art. 316 alin. (12))',
    } as Record<VatRegistrationStatus, string>,
    vatRegistrationHint:
      'Necompletat nu înseamnă „scutit”. Câtă vreme aplicația nu știe starea, ea nu alege măsura banilor pe care o calculează și nu stabilește dacă ai drept de deducere; fiecare variantă schimbă atât venitul cât și cheltuiala deductibilă. Scutirea de TVA se aplică și când cifra de afaceri este exact egală cu plafonul — „nu depășește”. Aplicația nu deduce starea din cifra de afaceri pe care o ai înregistrată, pentru că plafonul se măsoară pe un venit restrâns la operațiunile cu locul în România, pe care aplicația nu îl calculează.',
    vatCashAccounting: 'Aplici regimul TVA la încasare',
    vatCashAccountingHint:
      'Nu este o stare de înregistrare, ci un regim care amână exigibilitatea și, cu ea, dreptul de deducere. Amână în ambele sensuri: deducerea întârzie până când ai plătit furnizorul, iar taxa de la un furnizor care aplică el însuși acest regim poate fi dedusă abia când el a încasat-o. Fac excepție achiziția intracomunitară, importul și taxarea inversă. Regimul se menționează obligatoriu pe factură.',
    vatExceedanceDate: 'Data depășirii pragului de TVA',
    vatExceedanceDateHint:
      'Necompletat înseamnă că aplicația nu cunoaște data și nu afișează niciun termen de înregistrare.',
    cashFloor: 'Prag plăți în numerar (lei)',

    /**
     * B-97 (D-AIC-1, D-AIC-2) — the two art. 322 alin. (7)-(8) facts, collected on this tab.
     *
     * WHY IT IS ASKED IN PLAIN WORDS. „achiziție intracomunitară de bunuri” is the term the code and the
     * decont use; it is not vocabulary a PFA owns. The person who has to answer this knows only that they
     * bought goods in another EU country and brought them in. So the question is put in those words and the
     * technical term is kept beside it, with the citation attached to the answer rather than substituted
     * for the question.
     *
     * WHY THE MONTH AND NEVER THE QUARTER. The model derives the quarter from the month
     * (`Math.ceil(month / 3)`). A quarter typed by hand can be wrong by one month in a way no arithmetic
     * downstream can detect — the number would still be a valid quarter. The month is the fact the person
     * actually knows, and the quarter is shown as what the app derived from it.
     *
     * WHY THE QUESTION IS CONDITIONAL, AND WHY THE REFUSAL IS SPOKEN. Art. 322 alin. (7) turns a quarter
     * into months. Someone outside the VAT register has no decont to split, and someone already monthly has
     * nothing to flip — asking them is noise. But silence would hide the law from exactly the person who
     * may be affected, so each case says why it is not asking instead of rendering nothing.
     *
     * WHY THE CONFIRMATION EXISTS (D-AIC-2). A „da” here is not a preference; it moves a fiscal period and
     * adds a filing duty. The three consequences are shown before anything is written, and the record says
     * `confirmedBy: 'user'` so it can never read as the app's own conclusion.
     */
    aic: {
      title: 'Bunuri cumpărate dintr-un alt stat al Uniunii Europene',
      citation: 'CF art. 322 alin. (7) și (8)',
      question: (year: number): string =>
        `În ${year}, ai cumpărat bunuri dintr-un alt stat al Uniunii Europene — de exemplu marfă adusă în România — și taxa pe valoarea adăugată pentru acea achiziție s-a datorat în România?`,
      termNote:
        'În Codul fiscal operațiunea se numește „achiziție intracomunitară de bunuri”. Întrebarea de mai sus este pusă în cuvinte simple, pentru că termenul tehnic nu este unul pe care un PFA să îl folosească în mod curent; citația rămâne atașată de răspuns.',
      answerUnanswered: 'Nu este înregistrat — aplicația nu a întrebat',
      answerDa: 'Da',
      answerNu: 'Nu',
      monthLabel: (year: number): string =>
        `În ce lună a anului ${year} a intervenit exigibilitatea, adică momentul în care taxa s-a datorat în România?`,
      monthPlaceholder: 'Alege luna',
      monthNames: [
        'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
        'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
      ],
      quarterDerived: (quarter: number): string =>
        `Trimestrul rezultă din lună: T${quarter}. Aplicația nu întreabă trimestrul, pentru că se calculează din lună, iar un trimestru tastat poate greși o lună fără ca nicio verificare să observe.`,
      // Why the question is not asked. Each branch names its own reason; none of them is a blank space.
      notAskedNotRegistered:
        'Întrebarea nu se pune pentru că registrul arată că nu ești înregistrat(ă) în scopuri de TVA. Fără cod de TVA nu se depun deconturi, deci nu există nicio perioadă de schimbat.',
      notAskedRegistrationUnknown:
        'Întrebarea nu se pune încă: aplicația nu cunoaște starea ta de înregistrare în scopuri de TVA și nu știe nici dacă ai deconturi de depus. Completează mai întâi „Starea de înregistrare în scopuri de TVA”.',
      notAskedMonthly: (year: number): string =>
        `Întrebarea nu se pune pentru că pe ${year} perioada fiscală este deja luna calendaristică. Art. 322 alin. (7) transformă trimestrul în luni; acolo unde luna se aplică deja, nu este nimic de schimbat.`,
      notAskedMonthlyByUser: (year: number): string =>
        `Întrebarea nu se pune pentru că pe ${year} ai declarat deja că depui lunar. Art. 322 alin. (7) transformă trimestrul în luni; acolo unde luna se aplică deja, nu este nimic de schimbat.`,
      recordedForYear: (year: number): string =>
        `Fapta este înregistrată pentru ${year}. O poți modifica de aici.`,
      // The three consequences of D-AIC-2, shown before anything is saved.
      effectsTitle: 'Ce schimbă acest răspuns',
      effectsIntro: (year: number): string =>
        `Răspunsul „da” pentru ${year} nu este o simplă bifă: schimbă perioada fiscală și adaugă o obligație de depunere. Citește cele trei efecte și confirmă. Nimic nu este salvat până la „Confirm și salvez”.`,
      effectMonthly: 'Perioada fiscală devine luna calendaristică.',
      // B-101 — „devine luna calendaristică" is only half of alin. (7): the article says „începând cu" a
      // month it then names. Without the second sentence the panel promises a year of months and the
      // calendar shows a quarterly return for every quarter closed before that month — the promise and the
      // calendar drifting in the direction that under-states nothing but misleads anyway.
      effectSince: (fromLabel: string): string =>
        `Luna calendaristică se aplică începând cu ${fromLabel}; până la acea lună perioada fiscală rămâne trimestrul calendaristic, cu un singur decont pentru fiecare trimestru încheiat înainte de ea.`,
      effectSinceNextYear: (year: number): string =>
        `Luna calendaristică începe abia în ${year}; anul în curs rămâne în întregime trimestrial, câte un singur decont pe trimestru.`,
      effectReturnsOne: (quarter: number): string =>
        `Trimestrul T${quarter} rămâne neatins și se declară într-un singur decont; luna calendaristică începe cu trimestrul următor.`,
      effectReturnsSplit: (quarter: number, count: number, periods: string): string =>
        `În loc de un singur decont pe trimestrul T${quarter}, se depun ${count} deconturi pentru aceeași perioadă: ${periods}.`,
      effectMentiuni: (dueOn: string, monthName: string, year: number): string =>
        `Se adaugă o declarație de mențiuni, separată de deconturi, până la ${dueOn} — maximum 5 zile lucrătoare de la finele lunii ${monthName} ${year}.`,
      review: 'Verific și confirm schimbarea',
      confirmTitle: 'Confirmi schimbarea perioadei fiscale',
      confirmWarning:
        'Schimbarea se aplică în registrul aplicației și în calendarul de depunere. Ea nu constituie nicio declarație transmisă către ANAF.',
      confirmCancel: 'Nu confirm',
      confirmGo: 'Confirm și salvez',
      pendingNote: 'Răspunsul nu este salvat încă. Alege „Verific și confirm schimbarea”.',
      savedNote: (year: number): string =>
        `Răspunsul pentru ${year} este înregistrat ca al dumneavoastră, nu ca o concluzie a aplicației.`,
      calendarLink: 'Calendarul de depunere și declarația de mențiuni le găsești pe pagina Declarații.',
      toastSaved: 'Răspunsul despre achiziția din alt stat UE a fost confirmat și salvat',
    },
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
    /**
     * PG-11 (phase 29) — export and import.
     *
     * The two sentences that carry the weight are `backupBody` and `importRejected`. The first has to say
     * what a backup contains, because the whole point of this phase is that the documents are in it even
     * though they no longer live where the rest of the data does. The second has to say that a refused file
     * changed nothing, because "import failed" on its own leaves a person wondering what is now on screen.
     */
    backupCard: 'Copie de rezervă',
    backupBody:
      'Exportul conține tot ce ai înregistrat, inclusiv documentele și versiunea formatului. Importul citește și verifică întregul fișier înainte să scrie orice.',
    backupExport: 'Exportă o copie',
    backupImport: 'Importă o copie',
    backupWorking: 'Se lucrează la fișier…',
    /** The blob store is connected: the ceiling that document bytes used to hit is gone. */
    blobConnected: 'Documentele sunt păstrate în afara datelor aplicației.',
    /**
     * `'unavailable'` is stated, not hidden. The app is correct in this state — documents keep working — but
     * the space limit the phase exists to remove is still there, and a person stacking up scans needs to
     * know that before a save starts failing.
     */
    blobUnavailable:
      'Depozitul de documente nu este disponibil aici. Documentele rămân împreună cu datele și limita de spațiu se aplică în continuare.',
    blobRelocated: (n: number): string => `${n} documente au fost mutate în depozitul de documente.`,
    /** The relocation failure path: the bytes stayed where they were, and that is the safe outcome. */
    blobRelocationFailed: (n: number): string =>
      `${n} documente și-au păstrat octeții împreună cu datele, pentru că scrierea a eșuat.`,
    /** Orphans are reported. Nothing here deletes a blob the app did not just lose. */
    blobOrphans: (n: number): string =>
      `${n} octeți nu mai au niciun document care să arate la ei. Sunt raportați, nu șterși.`,
    blobReclaimFailed: (n: number): string =>
      `${n} documente au fost șterse, dar octeții lor nu au putut fi eliberați.`,
  },
  dataToasts: {
    sandboxLoaded: 'Sandbox încărcat. Nu se salvează și nu ating datele tale.',
    sandboxUnloaded: 'Sandbox eliminat. Datele tale sunt exact cum erau.',
    allCleared: 'Toate datele au fost șterse. Începem de la zero.',
    /** A backup that omits a document is a corrupt backup, so nothing is written when a read fails. */
    exportRefused: (n: number): string =>
      `Nu am exportat nimic: nu am putut citi octeții a ${n} documente. Un rezervă incompletă este mai gravă decât lipsa ei.`,
    exported: (docs: number): string => `Copia a fost descărcată, cu ${docs} documente în ea.`,
    imported: (from: number, to: number): string =>
      `Datele au fost restaurate (format ${from} → ${to}).`,
    importRejected: 'Fișierul a fost respins și copia lui a fost păstrată. Datele tale nu s-au schimbat.',
    importBlobPartial: (n: number): string =>
      `${n} documente au rămas cu octeții împreună cu datele, pentru că depozitul nu le-a primit.`,
  },
} as const;
