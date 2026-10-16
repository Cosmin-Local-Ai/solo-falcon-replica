#!/usr/bin/env python3
"""
Regenerate the `### 4a` roll-up of the defect register in `docs/ai/PHASE_PLAN_11_34.md`.

Why this exists
---------------
Brief 79 built that roll-up **by hand**, and it was stale within a day: brief 80 found the table said
34 / 85 / 131 while the greps said 36 / 85 / 133, because B-156 and B-157 had been minted as open rows
and never entered the counts. That is §12.19's failure one level up — a hand-maintained derived table is
just a new place to be stale. Brief 81 minted this script so the numbers stop being typed.

What it regenerates
-------------------
Three derived blocks, each delimited in the file by a marker comment so the script can find and replace
it without touching the prose around it:

  ROLLUP:TABLE   the token-count table (and the Total row)
  ROLLUP:OPEN    "Open, grouped by what unblocks it"
  ROLLUP:CLOSED  "Closed in the last two weeks"

The prose paragraphs in `### 4a` — why the roll-up exists, which two rows it will not tidy — stay
hand-written. They are argument, not arithmetic.

Guarantees
----------
* **Idempotent.** Running it twice leaves the file byte-identical.
* **It does not count its own output.** Rows are only recognised outside the `### 4a` section, and the
  generated blocks are inside it. A token spelled in the prose therefore cannot inflate a count.
* **It fails loudly when the token sum disagrees with the row count** — that disagreement is the whole
  point of the table. A row with no status token is reported by id, not absorbed.
* **It prints the counts to stdout** so a Worker can paste them into a handoff per §12.21.
* **Standard library only.**

Usage
-----
    python3 docs/ai/tools/register_rollup.py            # rewrite the file in place
    python3 docs/ai/tools/register_rollup.py --check    # exit 1 if the roll-up is stale
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

REGISTER = Path(__file__).resolve().parents[2] / "ai" / "PHASE_PLAN_11_34.md"

HEADING = "### 4a. Register roll-up"
TABLE_ANCHOR = "| Token | Rows | What it means |"
# The defect-register tables. Both of them, and only them: the document holds other tables whose first
# cell is also a bolded id (`**D1**` appears again in §11b), and counting those is how a roll-up starts
# disagreeing with the greps it is supposed to reproduce.
REGISTER_TABLE_HEADER = "| Id | Defect | Closed by |"

# A register row: a table line whose first cell is a bolded id, struck or not.
# `**B-38**`, `~~**B-36**~~`, `**B-16** (remainder)`, `~~**6h-1**~~`.
ROW_ID = re.compile(r"^\|\s*(?:~~)?\*\*(?P<id>[A-Za-z0-9][A-Za-z0-9\-^]*)\*\*")

# The status token, at the head of the Defect cell.
TOKEN = re.compile(
    r"\[(?P<token>OPEN|CLOSED \d{4}-\d{2}-\d{2}|BLOCKED: research|BLOCKED: decision|"
    r"BLOCKED: chain|PARKED|REFUTED)\]"
)

# What unblocks each BLOCKED group, in the order the roll-up prints them.
BLOCKED_GROUPS = [
    ("BLOCKED: research", "Needs a Researcher"),
    ("BLOCKED: decision", "Needs a user decision"),
    ("BLOCKED: chain", "Needs a chain step"),
]

MARKER = re.compile(r"<!-- ROLLUP:(?P<what>[A-Z]+):BEGIN -->")


def split_row(line: str) -> list[str]:
    """Cells of a markdown table line. A row may carry extra cells; only the first two matter."""
    return [c.strip() for c in line.strip().strip("|").split("|")]


def parse_rows(lines: list[str], start: int, stop: int) -> list[tuple[str, str, str]]:
    """(id, token, token_date) for every row in the defect register between `start` and `stop`.

    The span is bounded by the register's own structure — from the first `Id | Defect | Closed by`
    header after the roll-up to the next level-2 heading — because the register's tables are broken up
    by blank lines and by continuation prose, and a row-counting rule that trusted markdown table
    syntax would quietly lose the rows in between. That is a third of the way this roll-up went stale.
    """
    rows: list[tuple[str, str, str]] = []
    for line in lines[start:stop]:
        m = ROW_ID.match(line)
        if not m:
            continue
        cells = split_row(line)
        if len(cells) < 2:
            continue
        defect = cells[1]
        t = TOKEN.search(defect)
        status = t.group("token") if t else ""
        date = ""
        if status.startswith("CLOSED"):
            date = status.split(" ", 1)[1]
            status = "CLOSED"
        rows.append((m.group("id"), status, date))
    return rows


def counts(rows: list[tuple[str, str, str]]) -> Counter[str]:
    return Counter(tok for _, tok, _ in rows)


def render_table(c: Counter[str]) -> list[str]:
    order = [
        ("OPEN", "open, nothing external in the way — free to brief now"),
        ("CLOSED", "closed on the date in the token, by the phase or brief named in the row"),
        ("BLOCKED: research", "the row says it waits on a primary source a Researcher must settle"),
        ("BLOCKED: decision", "the row says the next move is a user decision, not code"),
        ("BLOCKED: chain", "the row says it waits on a migration/chain step"),
        ("PARKED", "parked by user decision, reason in the row"),
        ("REFUTED", "the row's premise was withdrawn or refuted; the claim is kept, struck, as evidence"),
    ]
    out = [TABLE_ANCHOR, "|---|---|---|"]
    for status, meaning in order:
        label = "CLOSED 2026-MM-DD" if status == "CLOSED" else status
        out.append(f"| {label} | {c[status]} | {meaning} |")
    total = sum(c[s] for s, _ in order)
    addend = " + ".join(str(c[s]) for s, _ in order if c[s])
    out.append(f"| **Total** | **{total}** | {addend} |")
    return out


def render_open(rows: list[tuple[str, str, str]]) -> list[str]:
    by_status: dict[str, list[str]] = defaultdict(list)
    for rid, status, _ in rows:
        by_status[status].append(rid)
    out = ["**Open, grouped by what unblocks it**", ""]
    for status, heading in BLOCKED_GROUPS:
        ids = by_status[status]
        out.append(f"- **{heading} ({len(ids)}):** {', '.join(ids) if ids else '—'}.")
    free = by_status["OPEN"]
    out.append(f"- **Free to brief now ({len(free)}):** {', '.join(free)}.")
    return out


def render_closed(rows: list[tuple[str, str, str]]) -> list[str]:
    by_date: dict[str, list[str]] = defaultdict(list)
    for rid, status, date in rows:
        if status == "CLOSED":
            by_date[date].append(rid)
    if not by_date:
        return ["**Closed, by the date in the token**", ""]
    newest, oldest = max(by_date), min(by_date)
    total = sum(len(v) for v in by_date.values())
    out = [
        f"**Closed, by the date in the token ({oldest} → {newest}) — {total} closures; the register does "
        "not reach further back.**",
        "",
    ]
    for date in sorted(by_date, reverse=True):
        ids = by_date[date]
        out.append(f"- **{date} ({len(ids)}):** {', '.join(ids)}.")
    return out


def replace_block(lines: list[str], what: str, new: list[str]) -> list[str]:
    begin = end = None
    for i, line in enumerate(lines):
        m = MARKER.search(line)
        if m and m.group("what") == what:
            begin = i
        if begin is not None and i > begin and f"<!-- ROLLUP:{what}:END -->" in line:
            end = i
            break
    if begin is None or end is None:
        raise SystemExit(
            f"register_rollup: the {what} block is not delimited in the register. Add "
            f"`<!-- ROLLUP:{what}:BEGIN -->` / `<!-- ROLLUP:{what}:END -->` around it once, by hand."
        )
    return lines[: begin + 1] + new + lines[end:]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="fail instead of rewriting, if the roll-up is stale")
    ap.add_argument("--path", type=Path, default=REGISTER, help="the register file")
    args = ap.parse_args()

    text = args.path.read_text(encoding="utf-8")
    lines = text.split("\n")

    try:
        heading_at = next(i for i, line in enumerate(lines) if line.startswith(HEADING))
    except StopIteration:
        raise SystemExit(f"register_rollup: no `{HEADING}` heading in {args.path}") from None

    # Everything from the heading to the first row table is the roll-up itself: its prose and its own
    # generated blocks. Rows are parsed only after it, so the script can never count its own output.
    try:
        rows_start = next(i for i in range(heading_at + 1, len(lines)) if lines[i].strip() == REGISTER_TABLE_HEADER)
    except StopIteration:
        raise SystemExit(f"register_rollup: no row table after `{HEADING}` in {args.path}") from None
    try:
        rows_stop = next(i for i in range(rows_start + 1, len(lines)) if re.match(r"^## ", lines[i]))
    except StopIteration:
        rows_stop = len(lines)

    rows = parse_rows(lines, rows_start, rows_stop)
    c = counts(rows)

    untokenised = [rid for rid, status, _ in rows if not status]
    if untokenised:
        raise SystemExit(
            "register_rollup: these rows carry no status token, so the sum cannot be trusted: "
            + ", ".join(untokenised)
        )

    total = sum(c.values())
    if total != len(rows):  # unreachable while every row is tokenised; kept so the check cannot rot
        raise SystemExit(f"register_rollup: token sum {total} != row count {len(rows)}")

    out = lines
    out = replace_block(out, "TABLE", render_table(c))
    out = replace_block(out, "OPEN", render_open(rows))
    out = replace_block(out, "CLOSED", render_closed(rows))
    new_text = "\n".join(out)

    print(f"rows parsed:      {len(rows)}")
    for status in ("OPEN", "CLOSED", "BLOCKED: research", "BLOCKED: decision", "BLOCKED: chain", "PARKED", "REFUTED"):
        print(f"{status + ':':<20} {c[status]}")
    print(f"{'sum':<20} {total}")
    print(f"row count:        {len(rows)}")
    print(f"agreement:        {'ok' if total == len(rows) else 'MISMATCH'}")

    if args.check:
        if new_text != text:
            print("STALE: the roll-up does not match the rows. Run without --check.")
            return 1
        print("roll-up is current.")
        return 0

    if new_text == text:
        print("no change: the roll-up was already current.")
        return 0
    args.path.write_text(new_text, encoding="utf-8")
    print(f"rewrote {args.path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
