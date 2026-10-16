#!/usr/bin/env python3
"""
Ingest CAEN Rev.3 from the raw MO 385 text into caen_rev3.csv.

Run:  python3 ingest_caen_rev3.py
Input : caen_rev3_mo385_raw.txt    (verbatim paste of Ordinul INS 377/2024, MO I 385/25.04.2024)
        caen_rev3_corrections.json (the correction table — data, not code)
Output: caen_rev3.csv              (cod, nivel, parinte, sectiune, denumire)

This is the ONLY supported way to regenerate the dataset. It is deterministic and
IDEMPOTENT: it always starts from the raw text, so corrections are applied exactly
once no matter how often it runs. Editing caen_rev3.csv by hand is not supported —
add a row to the correction table and re-run.

Exit code is non-zero if the counts or the structural checks fail, so this can be
wired straight into a test.
"""
import collections
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "caen_rev3_mo385_raw.txt")
CORR = os.path.join(HERE, "caen_rev3_corrections.json")
OUT = os.path.join(HERE, "caen_rev3.csv")

EXPECTED = {"diviziune": 87, "grupa": 287, "clasa": 651, "sectiune": 22}
LEVEL = {2: "diviziune", 3: "grupa", 4: "clasa"}
SEPARATOR = "-" * 79 + "\n"


def normalise_diacritics(text):
    """Ordinul 377/2024 as typeset mixes comma-above s-with-comma (U+015F) and
    t-with-comma (U+0163) with the modern comma-below s (U+0219) and t (U+021B),
    sometimes inside one entry (0163). We store comma-below throughout: it is what
    a modern Romanian keyboard produces, and storing anything else makes the
    type-ahead fail on text the user has just read on screen."""
    table = {"\u015e": "\u0218", "\u015f": "\u0219", "\u0162": "\u021a", "\u0163": "\u021b"}
    for bad, good in table.items():
        text = text.replace(bad, good)
    return text


def read_text(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return handle.read()
    except OSError as exc:
        raise SystemExit(f"cannot read {path}: {exc}") from exc


def is_sectiune(token):
    upper = token.upper()
    return upper.startswith(("SEC\u021aIUNEA", "SEC\u0162IUNEA"))


def parse(raw):
    """Return one dict per classification entry: cod, denumire, sectiune."""
    if SEPARATOR not in raw:
        raise SystemExit("raw file is missing its separator line; refusing to parse")
    body = raw.split(SEPARATOR, 1)[1]

    page = 1
    sectiune = None
    rows = []
    buf = None

    def is_page_artefact(token):
        # In this extraction page numbers appear DOUBLED: 22 = page 2, 1010 = page 10,
        # 3030 = page 30. A naive "drop pure-digit lines" rule destroys real codes —
        # 2020 is a genuine class, and bare codes 101/203/2030/266/2660/981 sit alone
        # on a line with their description on the next. Requiring the digits to be a
        # doubling of the NEXT expected page number separates the two cleanly.
        nonlocal page
        if not re.fullmatch(r"\d{1,4}", token):
            return False
        if token == str(page + 1) * 2:
            page += 1
            return True
        return False

    for line in body.split("\n"):
        token = line.strip()
        if not token:
            continue
        if is_sectiune(token):
            sectiune, buf = token, None
            continue
        # Everything before the first secțiune is the PDF page header, not data.
        # Its leading "11" is a page number and would otherwise become a phantom diviziune.
        if sectiune is None:
            continue
        if is_page_artefact(token):
            continue
        match = re.match(r"^(\d{2,4})\s+(.*)$", token)
        if match:
            buf = {"cod": match.group(1), "denumire": match.group(2).strip(), "sectiune": sectiune}
            rows.append(buf)
        elif re.fullmatch(r"\d{2,4}", token):
            buf = {"cod": token, "denumire": "", "sectiune": sectiune}
            rows.append(buf)
        elif buf is not None:
            joined = f"{buf['denumire']} {token}" if buf["denumire"] else token
            buf["denumire"] = joined.strip()
    return rows


def apply_corrections(rows, spec):
    failed = []
    for entry in spec.get("corrections", []):
        hit = False
        for row in rows:
            if row["cod"] != entry["cod"]:
                continue
            if "nivel" in entry and LEVEL.get(len(row["cod"])) != entry["nivel"]:
                continue
            if entry["find"] in row["denumire"]:
                row["denumire"] = row["denumire"].replace(entry["find"], entry["replace"])
                hit = True
        if not hit:
            failed.append((entry["cod"], entry["find"]))
    return failed


def check(rows, failed):
    counts = collections.Counter(row["nivel"] for row in rows)
    counts["sectiune"] = len({row["sectiune"] for row in rows})
    problems = []
    if failed:
        problems.append(f"corrections not matched: {failed}")
    for key, want in EXPECTED.items():
        if counts[key] != want:
            problems.append(f"{key}: got {counts[key]}, expected {want}")
    duplicates = [code for code, n in collections.Counter(r["cod"] for r in rows).items() if n > 1]
    if duplicates:
        problems.append(f"duplicate codes: {duplicates}")
    grupe = {r["cod"] for r in rows if len(r["cod"]) == 3}
    diviziuni = {r["cod"] for r in rows if len(r["cod"]) == 2}
    clase = [r for r in rows if len(r["cod"]) == 4]
    for row in clase:
        cod = row["cod"]
        if cod[:3] not in grupe:
            problems.append(f"clasa {cod} has no grupa")
        if cod[:2] not in diviziuni:
            problems.append(f"clasa {cod} has no diviziune")
    for grupa in grupe:
        if not any(r["cod"][:3] == grupa for r in clase):
            problems.append(f"grupa {grupa} has no clasa")
    for diviziune in diviziuni:
        if not any(r["cod"][:2] == diviziune for r in clase):
            problems.append(f"diviziune {diviziune} has no clasa")
    for row in rows:
        if not row["denumire"]:
            problems.append(f"empty denumire: {row['cod']}")
    return problems, counts


def write_csv(rows):
    try:
        with open(OUT, "w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["cod", "nivel", "parinte", "sectiune", "denumire"])
            for row in rows:
                writer.writerow([row["cod"], row["nivel"], row["parinte"],
                                 row["sectiune_lit"], row["denumire"]])
    except OSError as exc:
        raise SystemExit(f"cannot write {OUT}: {exc}") from exc


def main():
    rows = parse(read_text(RAW))
    try:
        spec = json.loads(read_text(CORR))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"correction table is not valid JSON: {exc}") from exc

    for row in rows:
        # normalise BEFORE corrections so the table can be written in one diacritic dialect
        row["denumire"] = normalise_diacritics(row["denumire"])
        row["sectiune"] = normalise_diacritics(row["sectiune"])

    failed = apply_corrections(rows, spec)

    for row in rows:
        row["denumire"] = re.sub(r"\s+", " ", row["denumire"]).strip()
        row["sectiune"] = re.sub(r"\s+", " ", row["sectiune"]).strip()
        row["nivel"] = LEVEL[len(row["cod"])]
        row["parinte"] = row["cod"][:2] if len(row["cod"]) > 2 else ""
        head = re.split(r"\s*[-\u2013]\s*", row["sectiune"], maxsplit=1)[0]
        row["sectiune_lit"] = head.replace("SEC\u021aIUNEA", "").strip()

    problems, counts = check(rows, failed)
    write_csv(rows)

    print(f"wrote {os.path.basename(OUT)}: {len(rows)} rows | "
          f"{counts['diviziune']} diviziuni, {counts['grupa']} grupe, "
          f"{counts['clasa']} clase, {counts['sectiune']} sectiuni")
    if problems:
        print("FAILED:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print("all structural checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
