# CAEN Rev.3 — provenance of the data in this directory

**Written 2026-10-14. Read this before using or regenerating `caen_rev3.csv`.**

## Decisions taken by the user, 2026-10-14
1. **Ship the corrected text, single `denumire` field.** The malformed strings are in the *source*, but they would be shown to users in the Settings type-ahead, so they are fixed in place. **The uncorrected text is not lost — `caen_rev3_mo385_raw.txt` is kept verbatim, and every change is listed in `caen_rev3_corrections.json` with its reason.**
2. **Comma-below `ș ț` (U+0219 / U+021B) throughout, normalised at ingest.** The source PDF mixes both encodings, sometimes inside one entry.
3. **The paste is good enough to ship.** The ONRC CSV is not chased further.

## Files
| File | What it is |
|---|---|
| `caen_rev3_mo385_raw.txt` | **Verbatim paste by the user** of the official classification table („11 Clasificarea activităţilor din economia naţionale — CAEN Rev. 3"), as extracted from the PDF of **Ordinul președintelui INS nr. 377/2024, MO I 385/25.04.2024**. Includes the PDF's doubled page-number artefacts and line-wrapped descriptions, unedited. |
| `ingest_caen_rev3.py` | **The only supported way to regenerate `caen_rev3.csv`.** Deterministic and idempotent — it always starts from the raw text, so corrections apply exactly once. Exits non-zero if the counts or structural checks fail, so it can be wired straight into a test. |
| `caen_rev3_corrections.json` | The correction table: 20 changes, each with `find`, `replace` and `why`, plus a `deliberately_not_changed` list. **Data, not code — add a row and re-run the ingest; do not hand-edit the CSV.** |
| `caen_rev3.csv` | The parsed, structured classification: `cod, nivel, parinte, sectiune, denumire`. **Generated — 1,025 rows: 87 diviziuni, 287 grupe, 651 clase, 22 secțiuni A–V.** |
| `caen_rev3_caen3ro_clase.json` | Secondary cross-check: 651 class→denumire pairs scraped from `caen3.ro/coduri-caen-rev-3` on 2026-10-14. **A private commercial site — its own footer states it is not affiliated with ONRC or INS.** Used only as a cross-check, never as a source of truth. |

## Counts — counted from the file, and asserted by the ingest script
**22 secțiuni (A–V) · 87 diviziuni · 287 grupe · 651 clase.**
Structural checks that passed: no duplicate codes · no grupa without a clasă · no diviziune without a clasă · every clasă has its grupa and diviziune present.
**The 22nd secțiune is V (organizații extrateritoriale).** caen3.ro advertises „21 secțiuni" while itself listing `9900` — its own count is inconsistent; ours is the one derived from the primary text.
**Absent diviziuni (genuine Rev.3 structure, not gaps in the paste):** 04, 34, 40, 44, 45, 48, 54, 57, 67, 76, 83, 89. Rev.3 dissolved Rev.2's `45` (auto trade and repair) into `467`/`478` and `953`, and `04` into `07`.

## Parsing rules that matter
- **PDF page numbers appear DOUBLED** in this extraction: `22` = page 2, `1010` = page 10, `2020` = page 20, `3030` = page 30. A naive "drop pure-digit lines" parser **destroys real codes** — `2020` is a genuine class, and bare codes `101`, `203`, `2030`, `266`, `2660`, `981` sit on their own line with the description on the next. The parser distinguishes them by requiring the digit-run to be a *doubling of the next expected page number*.
- **First parse produced 88 diviziuni / 648 clase and a duplicate `11`.** That was the parser, not the data. The corrected rules give 87 / 651.

## Cross-check against caen3.ro
**651 classes on both sides. Identical code sets — zero codes present on one side and absent on the other. Only 3 textual differences** after normalising diacritics and case:
| Cod | Official paste | caen3.ro |
|---|---|---|
| 0113 | …rădăcinoaselor şi **tuberculiferelor** | …rădăcinoaselor și **tuberculilor** |
| 2366 | Fabricarea **altor articolelor** din beton, ciment şi ipsos | Fabricarea **altor articole** din beton, ciment și ipsos |
| 2599 | Fabricarea **altor articolelor** din metal n.c.a. | Fabricarea **altor articole** din metal n.c.a. |

## ⚠️ The agreement does NOT certify the text
**caen3.ro carries the same malformed strings as the PDF extraction** — `mâncărururi` (1085), `tartare` (3823), `pshică` (8720), `similar` (1073), `bailor` (9623), `n.c. a` (6392), `masinilor` (283), `de de` (3092), `înteţinere` (8130), `spotive` (93), `materiallelor` (233), `activitoți` (60). **It scraped the same PDF and corrected nothing.** Two sources agreeing on a defect is a shared lineage, not corroboration.

## Corrections applied (20)
See `caen_rev3_corrections.json`. Two of them are **not** defects of the source and were left alone: `0113` „tuberculiferelor" is correct and matches CAEN Rev.2 (caen3.ro's „tuberculilor" is the error), and `3092` „invalizi" is the term the official text uses.
**Unresolved and deliberately not guessed:** secțiunea G's title ends in a bare semicolon in the PDF — the Rev.2 title continued with the repair of motor vehicles, and Rev.3 moved that activity to `467`/`478` and `953`. A shortened title is defensible, so it was **not** completed by inference.

## Bugs this pipeline already caught in itself
Worth recording, because each one silently corrupted the dataset before it was fixed:
- A naive *drop pure-digit lines* rule **destroyed real codes** — `2020` is a genuine class, and bare codes `101`, `203`, `2030`, `266`, `2660`, `981` sit alone on a line with their description on the next. Gave 88 diviziuni / 648 clase.
- **Corrections were not idempotent**: re-running a pass turned `similare` into `similaree`. Fixed by always regenerating from the raw text.
- **A correction pattern written in comma-above form stopped matching** once diacritics were normalised first (`8130`). The table is now written in comma-below throughout.
- **The normalisation table itself had the wrong code point**: capital `Ţ` was mapped to U+0222 (`Ȣ`) instead of U+021A (`Ț`), which rendered every section as `SECȢIUNEA`.

## Known defects in the official text as extracted (20 flagged)
| Cod | Nivel | Defect |
|---|---|---|
| 0163 | clasa | recoltare **și** pregătirea semin**ț**elor — diacritics switch mid-entry (source mixes ş/ţ with ș/ț) |
| 1073 | clasa | „…produse făinoase **similar**" — truncated; should be „similare" |
| 1085 | clasa | „**mâncărururi** preparate" — should be „mâncăruri" |
| 233 | grupa | „Fabricarea **materiallelor** de construcţii din argilă" — should be „materialelor" |
| 2521 | clasa | „…pentru încălzire **central**" — should be „centrală" |
| 3092 | clasa | „Fabricarea de biciclete **și de de** vehicule pentru invalizi" — duplicated „de" |
| 3823 | clasa | „Alte activități de **tartare** a deșeurilor" — should be „tratare" |
| 60 | grupa | „…agenții de știri și alte **activitoți** de distribuție de conținut" — should be „activități" |
| 6392 | clasa | „…servicii informaţionale **n.c. a**" — should be „n.c.a." |
| 8130 | clasa | „Activităţi de **înteţinere** peisagistică" — should be „întreţinere" |
| 8720 | clasa | „…centre de recuperare **pshică**…" — should be „fizică" |
| 93 | grupa | „Activităţi **spotive**, recreative şi distractive" — should be „sportive" |
| 9623 | clasa | „…saunelor și **bailor** de abur" — should be „băilor" |
| 283 | grupa | „Fabricarea **masinilor**…" — missing diacritics, should be „mașinilor" |
| 473 | grupa | „…carburanţilor pentru autovehicule **î**" — stray trailing „î" |
| 477 | grupa | „…cu excepţia autovehiculelor şi **motociclete**" — should be „motocicletei" |
| 4212 | clasa | trailing „." on „…căilor ferate de suprafaţă şi subterane." |
| 2811 | clasa | „…autovehicule şi motociclete**.)**" — stray period inside the parenthesis |
| 981 | grupa | description was split across lines in the PDF and had to be rejoined by the parser |

**Not yet decided (open question to the user):** whether to ship these **verbatim** or **corrected with a recorded diff table**. The defects are in the *source*, so "verbatim" is defensible; but several are plainly wrong Romanian and will be shown to users in the Settings type-ahead.

## Diacritics
The official PDF **mixes two encodings**: comma-**above** `ş ţ` (U+015F / U+0163, the old Windows-1250 convention) and comma-**below** `ș ț` (U+0219 / U+021B, the modern standard). caen3.ro normalises everything to comma-below. **Whichever we choose must be applied consistently, or the type-ahead will fail to match a code the user just read on screen.**

## Not obtained
- **ONRC `N_CAEN.CSV` on data.gov.ro (CC BY 4.0)** — the machine-readable file we hoped to ship directly. The researcher dispatched to locate the exact download URL was cancelled before returning. **Still the preferred source if it can be retrieved.**
- **caen3.ro's Rev.2→Rev.3 correspondence table** (`/corespondenta-caen-rev2-rev3`) — the server repeatedly closed the connection (`SSL_read: unexpected eof`). Relevant to migrating existing users' Rev.2 codes; **INS/ONRC publish an official correspondence table and that is the one to use.**
