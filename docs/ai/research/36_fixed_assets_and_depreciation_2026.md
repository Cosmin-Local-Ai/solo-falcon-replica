# R-F — Fixed assets and depreciation for a PFA în sistem real, FY2026

**Researcher:** `scout-R-f-fixed-assets-2026`, 2026-10-10. Transcribed by the Orchestrator (**Q-RESEARCHER-WRITE**). **A second pass is running to close its six gaps**; anything it is still holding is marked **GAP** here and must not be treated as settled.

**Why this one mattered:** **B-31** is the only open defect that produces a **wrong number today** rather than a missing feature. A capital purchase is currently deducted in full, in the year of purchase.

**Two premises of mine were wrong** (sixth and seventh instances): the useful-life Catalog is **HG 2.139/2004**, not HG 2117/2015; and **art. 68 alin. (7) lit. k^1) is in the *non-deductible* list**, not an allowance. **On k^1) the code was already right** — `EXPENSE_DEPRECIATION_PERSONAL_PATRIMONY_2026` carries `treatment: 'non_deductible'` and cites k^1) correctly. The error was in the brief.

---

## 1. The borrowing rule — what a Titlul IV PFA inherits

**1.1 FACT — the borrowing text.** CF art. 68 alin. (4): „Condițiile generale pe care trebuie să le îndeplinească cheltuielile efectuate în scopul desfășurării activității independente, pentru a putea fi deduse, în funcție de natura acestora, sunt: … **d) să respecte regulile privind amortizarea, prevăzute în titlul II, după caz**".

**1.2 FACT — reinforced, not narrowed, by three other Titlul IV hooks.**
- **art. 68 alin. (4¹)**: „…cu excepția cheltuielilor cu amortizarea care sunt deductibile potrivit prevederilor alin. (4) lit. d)".
- **art. 68 alin. (4) lit. e)** imports **art. 28 alin. (20)** (medical-cabinet / occupational-safety investments).
- **art. 68 alin. (4) lit. k)** imports **art. 28 alin. (4)**: non-depreciable assets — „cheltuielile sunt deductibile la momentul înstrăinării și reprezintă prețul de cumpărare sau valoarea stabilită prin expertiză tehnică la data dobândirii".

**1.3 FACT — the Titlul IV norms (HG 1/2016, MO 22/13.01.2016, Partea I, Titlul IV, Cap. II, Secțiunea a 2-a) are pct. 6–7, and pct. 7 runs alin. (1)–(8).** Confirmed by independent citations to „pct. 7 alin. (5) lit. o)", „pct. 7 alin. (2)", „pct. 7 alin. (5) lit. a)", „pct. 7 alin. (8)". ⚠️ **ghidfiscal.ro mis-numbers these as (5), (6), (8) — do not take its numbering as authority.**

**1.4 FACT — the operative norms, verbatim.**
- **pct. 7 alin. (5) lit. a)**: „cheltuielile cu achiziționarea de materii prime, materiale consumabile, **obiecte de inventar** și mărfuri".
- **pct. 7 alin. (5) lit. n)**: „**cheltuielile cu amortizarea, în conformitate cu prevederile art. 28 din Codul fiscal, după caz**".
- **pct. 7 alin. (5) lit. o)**: „valoarea rămasă neamortizată a bunurilor și drepturilor amortizabile înstrăinate, determinată prin deducerea din prețul de cumpărare a amortizării incluse pe costuri în cursul exploatării și **limitată la nivelul venitului realizat din înstrăinare**".
- **pct. 7 alin. (6)**: euro caps convert „la cursul mediu comunicat de Banca Națională a României pentru anul în care s-a efectuat plata".
- **pct. 7 alin. (7)** (vehicle): „…se limitează la 50 % dreptul de deducere a cheltuielilor efectuate conform art. 68 alin. (4) și (5)… **cu excepția cheltuielilor privind amortizarea pentru care se aplică regulile privind amortizarea prevăzute la art. 28 titlul II din Codul fiscal, după caz**." — **depreciation is NOT subject to the 50 % vehicle limit**; it takes art. 28's own caps instead.
- **pct. 7 alin. (8)**: „În aplicarea prevederilor art. 68 din Codul fiscal, **toate bunurile, drepturile și obligațiile aferente desfășurării activității se înscriu în Registrul-inventar și constituie patrimoniul afacerii**."

**1.5 FACT — the counter-text.** art. 68 alin. (7) lit. h): „cheltuielile de achiziționare sau de fabricare a bunurilor și a drepturilor amortizabile **din Registrul-inventar**". **The qualifier matters: the exclusion is scoped to assets carried in the business inventory register.**

**1.6 INFERRED — where the boundary falls, and label it as such in the rule package.** Neither art. 68 nor the Titlul IV norms contain a closed list of borrowed alineate. The line is drawn by three textual devices and nothing else: (i) „**după caz**"; (ii) the vehicle norm's explicit re-pointing to „art. 28 titlul II … după caz"; (iii) terminology substitution — „profit impozabil" → „venit net anual", „patrimoniul contribuabilului" → „patrimoniul afacerii / Registrul-inventar".
- **Inherited core:** art. 28 alin. (1), (2), (3), (4), (5), (6), (7), (8), (8¹)–(8³), (11)–(14), (17), (20), (21), (23)+Catalog, (25).
- **Structurally inapplicable:** alin. (9)–(10) (imobilizări necorporale „potrivit reglementărilor contabile aplicabile"), alin. (12) lit. g) and alin. (26) (IFRS-only), alin. (13) (subvenții guvernamentale), alin. (15)–(16) (resurse naturale), alin. (18)–(19) (component replacement under accounting regs), alin. (22) (containere/ambalaje), alin. (24) (acorduri petroliere).
**No primary source states this boundary. It is a reading, not a rule.**

---

## 2. The 5.000-lei threshold — function, figure, in force

**2.1 FACT — verbatim from the amending act** (OUG nr. 8 din 24.02.2026, **MO 147 din 25.02.2026**, **art. 6 pct. 7**): „La articolul 28 alineatul (2), litera b) se modifică și va avea următorul cuprins: **b) la data intrării în patrimoniul contribuabilului, are o valoare fiscală egală sau mai mare decât suma de 5.000 lei; această limită se actualizată anual, în funcție de indicele de inflație, prin hotărâre a Guvernului;**". ⚠️ The official text reads „se actualizată" — an apparent typo for „se actualizează", reproduced identically by KPMG.

**2.2 FACT — its function is classification, not expensing.** Art. 28 alin. (2): „Mijlocul fix amortizabil este orice imobilizare corporală care îndeplinește **cumulativ** următoarele condiții: a) este deținut și utilizat în producția, livrarea de bunuri sau în prestarea de servicii, pentru a fi închiriat terților sau în scopuri administrative; b) [the 5.000-lei test]; c) are o durată normală de utilizare mai mare de un an." Measured **at „data intrării în patrimoniul contribuabilului", not at payment.**

**2.3 FACT — sub-threshold is an *option* to depreciate, not an automatic direct expense.** Art. 28 alin. (21): „În cazul unei imobilizări corporale care la data intrării în patrimoniu are o valoare fiscală mai mică decât limita stabilită prin hotărâre a Guvernului, contribuabilul **poate** recupera aceste cheltuieli prin deduceri de amortizare, potrivit prevederilor prezentului articol." **Residual drafting inconsistency:** OUG 8/2026 moved the sum into the law but **did not amend alin. (21)**, which still points to a „limită stabilită prin hotărâre a Guvernului".

**2.4 FACT — OUG 8/2026 simultaneously closed the old direct-expensing door.** Art. 6 pct. 9 rewrites art. 28 alin. (25): „Prevederile Legii nr. 15/1994 … nu se aplică la calculul rezultatului fiscal, **cu excepția prevederilor art. 8** din aceeași lege." The pre-amendment text (still printed on ghidfiscal.ro) read „…cu excepția prevederilor **art. 3 alin. 2 lit. a)** și ale art. 8". Legea 15/1994 art. 3 alin. (2) lit. a) is precisely the entry-value condition, whose HG-set value was 2.500 lei under **HG 276/2013, MO 313/30.05.2013**. **Removing it eliminates the competing 2.500-lei reference; art. 8 (the Catalog) survives** — which is what keeps HG 2.139/2004 alive for a PFA.

**2.5 FACT — in force and first applicable year. Cite the amending act, not a consolidation.** OUG 8/2026 **art. 10**: „(1) Prin derogare de la prevederile art. 4 din Legea nr. 227/2015 … prevederile art. 6 intră în vigoare la data publicării … cu excepția prevederilor punctelor 25-44 care intră în vigoare la data de 1 martie 2026. (2) **Prevederile art. 6 pct. 1-14 se aplică începând cu anul fiscal 2026**…". Pct. 7 (threshold) and pct. 8 (alin. 8¹–8³) are inside 1–14 ⇒ **in force 25.02.2026, governing the whole of FY2026 — including January–February 2026 purchases.** A PFA always has a calendar fiscal year, so art. 16 alin. (5) is irrelevant here.

**2.6 FACT — transitional rule for the 2.500–5.000 band.** Art. 6 pct. 14 inserts **art. 45 alin. (21³)**: „…valoarea fiscală rămasă neamortizată a mijloacelor fixe cu valoarea fiscală de intrare cuprinsă între 2.500 lei și 5.000 lei, existente în patrimoniul contribuabililor la data de 31 decembrie 2025 … **se recuperează pe durata normală de utilizare rămasă**." **No retroactive reclassification.**

**2.7 FACT + documented negative — „obiecte de inventar" have NO separate lower lei threshold in fiscal law.** Searched CF art. 28, CF art. 68 and its Titlul IV norms, HG 2.139/2004, OMFP 170/2015: no lei figure attaches to „obiecte de inventar" anywhere in the fiscal texts. The only fiscal treatment is norm **pct. 7 alin. (5) lit. a)**, which lists them as deductible by example. Because art. 68 alin. (7) lit. h) excludes only „bunurilor și a drepturilor **amortizabile** din Registrul-inventar", a sub-threshold item that is *not* an amortizable asset is not caught by it. **CORROBORATED** practitioner reading: „Dacă lipsește condiția 2, bunul nu este mijloc fix, ci obiect de inventar: nu se amortizează, iar costul lui este deductibil la momentul plății."

---

## 3. Method, duration, start

**3.1 FACT — methods, art. 28 alin. (5), verbatim:** „a) În cazul construcțiilor, se aplică metoda de amortizare liniară; b) În cazul echipamentelor tehnologice, respectiv al mașinilor, uneltelor și instalațiilor de lucru, **precum și pentru computere și echipamente periferice ale acestora**, contribuabilul poate opta pentru metoda de amortizare liniară, degresivă sau accelerată; c) În cazul oricărui altui mijloc fix amortizabil, contribuabilul poate opta pentru metoda de amortizare liniară sau degresivă." **Optional per asset class, and belongs to the taxpayer** — nothing in Titlul IV removes that for a PFA.
- alin. (6) liniară: cota de amortizare liniară aplicată la „valoarea fiscală de la data intrării în patrimoniul contribuabilului".
- alin. (7) degresivă: coefficients „**1,5** dacă durata normală de utilizare … este între 2 și 5 ani; **2,0** … între 6 și 10 ani; **2,5** … mai mare de 10 ani".
- alin. (8) accelerată: „a) pentru primul an de utilizare, amortizarea nu poate depăși **50 %** din valoarea fiscală …; b) pentru următorii ani … raportarea valorii rămase de amortizare … la durata normală de utilizare rămasă".

**3.2 FACT — the 2026 super-accelerated addition, art. 28 alin. (8¹), inserted by OUG 8/2026 art. 6 pct. 8, verbatim:** „Prin excepție de la prevederile alin. (5) și (8), pentru **activele noi, achiziționate/produse și puse în funcțiune, în perioada cuprinsă între 1 ianuarie 2026-31 decembrie 2026 inclusiv** … **din subgrupa 2.1 - Echipamente tehnologice, respectiv mașini, unelte și instalații de lucru și/sau subgrupa 2.4 - „Animale și plantații"** se poate aplica o metodă de amortizare superaccelerată … a) pentru primul an de utilizare, amortizarea nu poate depăși **65 %** din valoarea fiscală …; b) pentru următorii ani … raportarea valorii rămase de amortizare … la durata normală de utilizare rămasă". Alin. (8²) covers imobilizări în curs de execuție started by 31.12.2025; **alin. (8³) is exclusively for art. 16 alin. (5) taxpayers — inapplicable to a PFA.**

**3.3 INFERRED — can a PFA use it?** Nothing in art. 68 or the Titlul IV norms excludes it, and the vehicle norm re-points depreciation to „art. 28 titlul II … după caz"; practitioner sources apply it to PFA. **But the gate is a Catalog subgrupa, not an asset type** — see §7 GAP 1.

**3.4 FACT — CORRECTION to my brief: the Catalog is HG nr. 2.139/2004, not HG 2117/2015.** „HOTĂRÂRE nr. 2.139 din 30 noiembrie 2004 pentru aprobarea Catalogului privind clasificarea și duratele normale de funcționare a mijloacelor fixe, **Publicat în MONITORUL OFICIAL nr. 46 din 13 ianuarie 2005**", adopted „în temeiul … art. 8 din Legea nr. 15/1994". Amended by **HG 1496/2008** and **HG 1276/2021 (MO 1226/24.12.2021**, in force 01.01.2022 — that amendment only touches pct. 7 of Cap. III, defence-sector norms).

**3.5 FACT — the range rule, Catalog Cap. I pct. 4, verbatim:** „În prezentul catalog pentru fiecare mijloc fix nou achiziționat se utilizează sistemul unor **plaje de ani** cuprinse între o valoare minimă și una maximă, existând astfel posibilitatea alegerii duratei normale de funcționare cuprinsă între aceste limite. Astfel stabilită, durata normală de funcționare a mijlocului fix **rămâne neschimbată până la recuperarea integrală a valorii de intrare** a acestuia sau scoaterea sa din funcțiune." Cap. I pct. 1: the durations „corespund cu duratele de amortizare în ani, aferente regimului de amortizare **liniar**". Cap. I pct. 3 names „agenții economici, persoanele juridice fără scop patrimonial cât și … instituțiile publice" — PF/PFA are not named, but a PFA is an „întreprindere economică" under OUG 44/2008.

**3.6 FACT — durations verified in Anexa nr. 1.** Grupa 2.3 Mijloace de transport: 2.3.2.1.1 autoturisme **4-6**; taxiuri 3-5; microbuze 4-8; autobuze 5-9 (urban 4-8); 2.3.2.2.1 autocamioane/autocamionete cu platformă fixă, autofurgonete, autofurgoane și autodube până la 4,5 t exclusiv **4-6**; ≥ 4,5 t 4-8; basculante/dumpere, autocisterne, autoizoterme 4-6; autotractoare 4-8; tractoare 4-6. Grupa 3: 3.1.1 mobilier **9-15**; 3.1.5 aparate electrocasnice/TV/video **4-6**; 3.2.1 aparate de copiat și multiplicat, proiecție **4-6**; 3.2.2 aparate de telecomunicații pentru birou **3-5**; 3.2.4 altă aparatură birotică **3-5**.
⚠️ **Consequence for the super-accelerated option:** the only subgrupa 2.1 line mentioning computers is **2.1.5.6** „Mașini, utilaje și instalații specifice pentru producția componentelor produselor și sistemelor electronice (… calculatoare și periferice, etc)" — 5-9 ani, i.e. **production machinery, not office IT**. A laptop is therefore very likely **outside subgrupa 2.1** and **not eligible for the 65 % method**, even though art. 28 alin. (5) lit. b) gives it the *accelerated* 50 % option. **GAP 1 — unresolved, product-critical.**

**3.7 FACT — start of depreciation, art. 28 alin. (12) lit. a), verbatim:** „Amortizarea fiscală se calculează după cum urmează: a) **începând cu luna următoare celei în care mijlocul fix amortizabil se pune în funcțiune**, prin aplicarea regimului de amortizare prevăzut la alin. (5)". **There is no separate pro-rating formula** — the first year simply carries the months from the month after punerea în funcțiune to Decembrie. Worked example (put in function March 2026, 48-month life): 2026 = 9 months (April–December), then 12/12/12, final year 3 months.

**3.8 FACT — caps that survive the borrowing.**
- **art. 28 alin. (14)**: for M1 passenger vehicles (≤ 9 seats incl. driver, RNTR 2 / OMMLTL 211/2003), „cheltuielile cu amortizarea sunt deductibile, pentru fiecare, **în limita a 1.500 lei/lună**", with four exception categories (urgency/guarding/courier; sales & purchasing agents incl. test-drive; paid passenger transport incl. taxi; paid services incl. rental and driving schools). Titlul II norm pct. 27 extends the cap at disposal: „valoarea rămasă neamortizată este deductibilă în limita a 1.500 lei înmulțită cu numărul de luni rămase de amortizat". **This cap is absent from our codebase entirely — new defect.**
- **art. 28 alin. (12) lit. i1)**: for a head office not used exclusively for the activity, situated in residential buildings and registered in the taxpayer's patrimony, „amortizarea este deductibilă la nivelul de **50 %**".
- **art. 28 alin. (17)**: „Pentru mijloacele fixe amortizabile, deducerile de amortizare se determină **fără a lua în calcul amortizarea contabilă**."

---

## 4. The cash-basis collision — the product-deciding answer

**4.1 FACT — the cash basis, verbatim.** Art. 68 alin. (2) lit. a): venit brut = „**sumele încasate** și echivalentul în lei al veniturilor în natură". Art. 68 alin. (4) lit. b): „**să fie cuprinse în cheltuielile exercițiului financiar al anului în cursul căruia au fost plătite**". Art. 68 alin. (1): „…ca diferență între venitul brut și cheltuielile deductibile **efectuate** în scopul realizării de venituri".

**4.2 FACT — depreciation is made deductible by a norm that attaches no payment condition.** Norm pct. 7 alin. (5) lit. n). **By contrast the same list shows the legislature does legislate cash timing when it wants to** — lit. v¹) „plăți efectuate în avans care se referă la perioade fiscale următoare".

**4.3 DOCUMENTED NEGATIVE — valuable.** No Titlul IV norm and no REF provision either (i) says depreciation is deductible „în cheltuielile anului" regardless of payment, or (ii) conditions depreciation on a payment having been made. Swept: HG 1/2016 Partea I Titlul IV Cap. II Secțiunea a 2-a pct. 6–7 (all eight alineate); OMFP 3254/2017 art. 1–10 and anexa nr. 1; CF art. 68 alin. (1)-(9); CF art. 28 all alineate.

**4.4 FACT — how the REF handles it (OMFP 3254/2017, MO 10/05.01.2018).** Art. 1 alin. (1): Titlul IV contributors determinați „în sistem real, în baza datelor din contabilitate" must complete the REF. Art. 3 alin. (1): „Registrul de evidență fiscală se completează anual cu totalul veniturilor și **totalul cheltuielilor efectuate** în scopul realizării acestora…". Art. 5 alin. (1): „Cheltuielile deductibile anual se evidențiază … **după caz, în funcție de natura acestora**, pe fiecare sursă din fiecare categorie de venit". **The REF model (anexa nr. 1) is a free-form table with no dedicated „cheltuieli cu amortizarea" line** — depreciation is just one nature-based row.

**4.5 FACT — the partidă-simplă register carries *fiscal* depreciation, the strongest textual argument that payment is not the trigger.** OMFP 170/2015, Registrul-inventar (cod 14-1-2/b), cap. V: „Pentru mijloace fixe și imobilizări necorporale, valoarea de inventar reprezintă diferența între valoarea de intrare și **amortizarea calculată potrivit legislației fiscale**."

**4.6 CORROBORATED — secondary only, no ANAF primary found.** The settled practitioner answer: „În contabilitatea în partidă simplă, achiziția unui mijloc fix **nu** este deductibilă la data plății. Este singura excepție de la regula „deduci când plătești". Plata se înregistrează integral în Registrul-jurnal de încasări și plăți, dar nu micșorează venitul net. **Deductibilă este exclusiv amortizarea lunară.**" And: „Amortizarea începe întotdeauna cu luna următoare celei în care mijlocul fix a fost pus în funcțiune, dovedită prin procesul-verbal de dare în folosință — **nu cu luna facturii și nu cu luna plății**." And: „Pragul se aplică la data intrării în patrimoniu, nu la data plății. Un bun cumpărat în decembrie 2025 și plătit în rate până în 2027 rămâne încadrat după pragul de 2.500 de lei."
**Operational answer for the product:** an asset bought and put in function in 2026 but paid in 2027 **starts depreciating in 2026** (the year of punerea în funcțiune), and the 2027 payment is recorded in the journal without reducing net income. **This is a reading of art. 28 alin. (12) lit. a) + norm pct. 7 alin. (5) lit. n) against art. 68 alin. (4) lit. b); it is not confirmed by any ANAF primary source found.** **GAP 3.**

**4.7 FACT — non-recoverable VAT enters the depreciable base** for a PFA that is not a TVA payer (art. 28 alin. (2) lit. b) speaks of „valoare fiscală"; OMFP 170/2015 pct. 16 of „cost de achiziție"). **Refinancing costs (dobânzi, comisioane de acordare, taxă de arhivă) are NOT part of the depreciable value** — they are separate financial expenses deductible at payment, 50 % for vehicles.

---

## 5. Assets from personal patrimony — **the premise was inverted**

**5.1 FACT — CORRECTION. Art. 68 alin. (7) lit. k^1) is an exclusion, not an allowance.** The chapeau of alin. (7) is „**Nu sunt cheltuieli deductibile:**", and lit. k^1) reads: „cheltuielile cu amortizarea bunurilor din patrimoniul personal afectate exercitării activității, potrivit legii". It sits between lit. k) (the 50 % vehicle rule) and lit. k³).
**Orchestrator note: our code already had this right.** `EXPENSE_DEPRECIATION_PERSONAL_PATRIMONY_2026` carries `treatment: 'non_deductible'` and cites `art. 68 alin. (7) lit. k^1)`, added by Legea 296/2020 (MO 1269/21.12.2020), effective 01.01.2021. **The wrong premise was in my brief.**

**5.2 FACT — provenance.** Legea 296/2020 art. I pct. 31 inserted k^1) and k^2) after lit. k).

**5.3 FACT — ANAF's own position.** ANAF București training deck „Tratamentul fiscal al veniturilor din activități independente": „**62. PFA în sistem real vor considera cheltuieli nedeductibile cheltuielile cu amortizarea bunurilor din patrimoniul personal afectate exercitării activității, potrivit legii.**"

**5.4 FACT — the „lege" in „potrivit legii" is OUG 44/2008 art. 2 lit. j)** (as amended by Legea 182/2016): „**patrimoniul de afectațiune** - masă patrimonială … reprezentând totalitatea drepturilor și obligațiilor **afectate, prin declarație scrisă** … exercitării unei activități economice". **The mechanism of affection is a written declaration, but it is a civil/liability device (OUG 44/2008 art. 20/26), not a tax permission.**

**5.5 FACT — the route that does exist: aport / transfer into the business patrimony.**
- art. 68 alin. (3) lit. a): aporturile în numerar sau în natură **nu sunt venit brut**.
- norm pct. 7 alin. (8): all business assets go in the **Registrul-inventar** and constitute „patrimoniul afacerii".
- **valuation — CF art. 7 pct. 44 lit. c)**: „valoarea fiscală … **costul de achiziție, de producție sau valoarea de piață a mijloacelor fixe dobândite cu titlu gratuit ori constituite ca aport, la data intrării în patrimoniul contribuabilului**, utilizată pentru calculul amortizării fiscale".
- OMFP 170/2015 pct. 16: elements at „valoarea de intrare, respectiv la cost de achiziție, de producție sau la prețul pieței".
- Working precedent for a **non-depreciable** personal asset (land) contributed PF→PFA: „înregistrat în Registrul Inventar al PFA ca **aport în natură** (pct. 7 alin. (8) din normele … art. 68)", la valoarea reevaluată conformă cu prețurile pieței, with cost deductible at disposal under art. 68 alin. (4) lit. k).

**5.6 FACT — the reverse direction is taxable.** Norm pct. 7 alin. (2): „În venitul brut al afacerii se include și suma reprezentând contravaloarea bunurilor și drepturilor din patrimoniul afacerii care trec … în patrimoniul personal al contribuabilului, operațiune considerată din punct de vedere fiscal **o înstrăinare**. Evaluarea acestora se face la prețurile practicate pe piață sau stabilite prin expertiză tehnică." Consistent with art. 68 alin. (2) lit. c) and alin. (7¹) lit. c).

**5.7 DOCUMENTED NEGATIVE.** No proportionalitate rule, no filed declaration, no special valuation form for personal-patrimony assets. Searched art. 68 alin. (4)-(7), Titlul IV norms pct. 6–7, OMFP 3254/2017, OMFP 170/2015, OUG 44/2008. The only proportionality rule available is the general mixed-use rule, **art. 68 alin. (5) lit. i)**: „cheltuielile efectuate pentru activitatea independentă, cât și în scopul personal al contribuabilului sau asociaților sunt deductibile **numai pentru partea de cheltuială care este aferentă activității independente**" — but that sits in the *deductibile-limitat* list and **does not override the absolute exclusion in alin. (7) lit. k^1) for depreciation**. Also relevant: alin. (7) lit. a) „sumele sau bunurile utilizate de contribuabil pentru uzul personal sau al familiei sale".

**5.8 CORROBORATED — the practical rule.** „Ca amortizarea să fie deductibilă, mijlocul fix trebuie să fi intrat în patrimoniul activității **pe baza unui document justificativ emis pe numele activității** — factură sau contract de vânzare-cumpărare cu datele PFA… O mașină rămasă în proprietatea ta ca persoană fizică și folosită în activitate prin comodat **nu se amortizează, indiferent de valoarea ei**." Under comodat only 50 % of running costs are deductible. And for goods: „intrarea mărfii din patrimoniul personal în patrimoniul afacerii nu generează venit brut, dar **nici nu generează o cheltuială deductibilă** a PFA-ului." **GAP 2 — the aport route vs k^1) conflict for depreciable assets is unresolved and is the single highest-value clarification for this product.**

---

## 6. Records this profile owes — all kept, none filed

**6.1 FACT — the governing accounting act is OMFP 170/2015, MO 139/24.02.2015** (art. 2 lit. a) covers PF/asociații fără personalitate juridică cu venit determinat în sistem real din activități independente; art. 3 allows a choice of partidă simplă or partidă dublă). Anchored in **Legea 82/1991 art. 5 alin. (5)**.

**6.2 FACT — the fiscal asset register obligation exists: Fișa mijlocului fix, cod 14-2-2.** OMFP 170/2015 **Cap. III pct. 17**: „**Evidența imobilizărilor corporale (mijloace fixe) se ține cu ajutorul Fișei mijlocului fix (cod 14-2-2)**."

**6.3 FACT — the other mandatory records, same act.** Cap. III pct. 9: „…se utilizează următoarele registre contabile: **Registrul-jurnal de încasări și plăți (cod 14-1-1/b)** și **Registrul-inventar (cod 14-1-2/b)**". Cap. III pct. 11: the journal records „toate sumele încasate și plătite" — **the full purchase price lands there even though it is not deductible**. Cap. II pct. 8: „obligația să efectueze **inventarierea** la începutul activității, cel puțin o dată pe an, precum și la încetarea activității". Cap. II pct. 11: „Persoanele care conduc contabilitatea în partidă simplă **nu întocmesc situații financiare anuale**."
⚠️ **Retention conflict — GAP 6.** This pass reports Cap. IV retention as **journal + Registru-inventar 10 ani**, justificative 5 ani, with documents for long-lived assets kept „pe perioada de utilizare a bunurilor". **R-D reported today** that **OMF 1.447/2023 (MO 453/24.05.2023)** amended OMFP 170/2015 Cap. IV — new **pct. 1¹, păstrare 5 ani** de la 1 iulie a anului următor, and **abrogated cap. IV pct. 2–4**. **Both cannot be the current text.** Sent back for resolution.

**6.4 FACT — the REF is separate, additional, and kept rather than filed.** CF art. 68 alin. (8)-(9) create the duty; **OMFP 3254/2017 art. 9**: „Registrul de evidență fiscală se păstrează **la domiciliul fiscal** al contribuabilului … fie în formă scrisă, fie în format electronic."

**6.5 FACT — nothing asset-specific is filed.** The D212 anexa reports only aggregates: Rd.1 „Venit brut", Rd.2 „**Cheltuieli deductibile, potrivit legii**", Rd.3 „Venit net anual". **There is no depreciation line and no asset annex on the D212.**

---

## 7. Gaps — all sent back to the same session

1. **Catalog position of calculatoare și echipamente periferice — unresolved and product-critical.** Only subgrupa 2.1 hit is 2.1.5.6 (production machinery, 5-9 ani). Whether a 2026 laptop qualifies for the **65 % super-accelerated** method turns entirely on this. **Next step given:** read Anexa nr. 1 to HG 2.139/2004 at Grupa 3, classes 3.2–3.3, in the official text.
2. **The aport route vs art. 68 alin. (7) lit. k^1) for *depreciable* assets is genuinely unresolved.** Highest-value clarification: the personal-car / personal-laptop case is the most common situation in this product.
3. **No ANAF primary source on the payment-vs-punere-în-funcțiune collision.**
4. **Mechanics of the 1.500 lei/lună M1 cap** — Titlul II norms pct. 26–33 not read in full (only pct. 27 via a secondary source).
5. **Titlul IV norm pct. 6 not read verbatim.**
6. **The OMFP 170/2015 Cap. IV retention conflict** with R-D's OMF 1.447/2023 finding.
7. **No inflation-indexing HG found** for the 5.000-lei limit — treat 5.000 lei as operative for FY2026 and keep the parameter overridable.
