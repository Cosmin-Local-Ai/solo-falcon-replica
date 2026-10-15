import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  CAEN_NOMENCLATOR_VERSION,
  caenByCod,
  caenClassProblem,
  caenLabel,
  caenLineageLabel,
  searchCaen,
  type CaenMatch,
} from '../../data/caenRev3';
import {
  CAEN_CLASS_CAP_CITATION,
  CAEN_MAX_ACTIVITY_CLASSES,
  type CaenCode,
} from '../../domain/models';
import { settings as settingsCopy } from '../../ui/copy';
import { Badge } from '../ui';

/**
 * B-124 — the CAEN control: one principal class and up to four secondary ones, each
 * resolved against the shipped CAEN Rev.3 nomenclator.
 *
 * ## The defect
 *
 * `identity.caen` has always been `CaenCode[]`. `Settings.tsx` read `identity.caen?.[0]?.cod`
 * into one text input and wrote index 0 back, preserving `slice(1)` untouched. So the model
 * held a list, the UI showed and edited one entry, and a person whose obiect de activitate
 * has a principal class plus secondary classes **could not enter the secondary ones at all**
 * — while any that were already there stayed invisible and uneditable. This component is the
 * fix: all five are editable, and the list is what the user sees.
 *
 * ## Why the persisted shape did not change
 *
 * The list is **positional**: index 0 is the class ONRC's cerere calls „Activitatea
 * principală", indices 1..4 the annex. That is the shape the data already had and the shape
 * the old UI already assumed when it labelled index 0 „Principal", so B-124 needed no new
 * field, no migration step and no schema bump — the head stays v21. See the note on
 * `PfaIdentity.caen` before turning the role into a stored field: that *would* be a persisted
 * shape change, and snapshots embed the whole profile, so it needs a migration and an
 * `inputsHash` re-derivation.
 *
 * ## Why the cap sentence is on the control
 *
 * „Cel mult 5" is **OUG 44/2008 art. 16 alin. (1)**. A limit printed without its article
 * reads as a product decision, and the arithmetic (1 + 4) invites the wrong reading that the
 * cap applies to a category called „secundară". It does not: it is a cap on the **total**.
 *
 * ## ⛔ What this control must never grow into
 *
 * **HG 656/1997 art. 4 alin. (1): „încadrarea … nu presupune crearea de drepturi sau
 * obligații".** Picking `5520` here must not switch on an accommodation calculation, and
 * picking `6210` must not set a rate, a ladder rung or a periodicity. The control may
 * *suggest* a demo persona or *prompt* a question the person then answers; it may not *set* a
 * tax fact. If you are about to read these codes from a calculator, stop and find the
 * statutory text that names the code — `src/data/caenRev3.ts` repeats the rule where the
 * codes live.
 */

/** One editable row. `text` is what is in the box; `code` is what was actually picked. */
interface CaenRow {
  readonly id: string;
  /** The committed code, `''` for a blank row. Always a CAEN Rev.3 class when non-empty. */
  readonly code: string;
  /** The visible text: `4791 — Intermedieri …` once picked, otherwise whatever was typed. */
  text: string;
  open: boolean;
  active: number;
}

export interface CaenDraft {
  /** The classes in list order: index 0 principal, 1..4 secondary. Blank rows are omitted. */
  readonly codes: CaenCode[];
  /** Why the list cannot be saved as it stands. Non-empty blocks the save. */
  readonly problems: readonly string[];
}

let rowSeq = 0;
const nextRowId = (): string => `caen-row-${++rowSeq}`;

/** An empty row: a class the person has not chosen yet, which is not the same as "no classes". */
const blankRow = (): CaenRow => ({ id: nextRowId(), code: '', text: '', open: false, active: -1 });

/**
 * The text a row would show if nobody had typed in it: the official `cod — denumire` label for
 * a code the nomenclator knows, the bare code for one it does not.
 *
 * This, not a stored "initial" string, is what separates an untouched box from a typed one. A
 * picked row's `text` is the label and its `code` is the code, so validating `text` as though
 * it were a code would call every successful pick invalid — which is exactly the bug the first
 * version of this control shipped.
 */
function committedText(row: CaenRow): string {
  if (row.code === '') return '';
  const entry = caenByCod(row.code);
  return entry ? caenLabel(entry) : row.code;
}

/** True when the box no longer says what the committed code says — i.e. the person typed in it. */
function isTouched(row: CaenRow): boolean {
  return row.text !== committedText(row);
}

function rowFromCode(code: CaenCode): CaenRow {
  const entry = caenByCod(code.cod);
  // A code saved before the nomenclator shipped may not exist in Rev.3 — this app's own seed
  // carried `6201` until step 11, and Rev.2 codes sit in real users' stored profiles. It is
  // shown as the bare code rather than dressed up with a denomination this app cannot cite for
  // it, and it is flagged rather than deleted: dropping a code on load is a data-loss event.
  const text = entry ? caenLabel(entry) : code.cod;
  return { id: nextRowId(), code: code.cod, text, open: false, active: -1 };
}

export function CaenClassList({
  value,
  onChange,
}: {
  value: readonly CaenCode[];
  onChange: (draft: CaenDraft) => void;
}) {
  const listId = useId();
  const [rows, setRows] = useState<CaenRow[]>(() =>
    // A profile with no CAEN at all still gets the principal row: an empty form that offers
    // nothing to fill is how a person concludes the field is not for them.
    value.length > 0 ? value.map(rowFromCode) : [blankRow()],
  );
  const boxRef = useRef<HTMLDivElement>(null);

  const patch = useCallback((id: string, next: Partial<CaenRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }, []);

  const pick = useCallback(
    (id: string, entry: CaenMatch['entry']) => {
      patch(id, { code: entry.cod, text: caenLabel(entry), open: false, active: -1 });
    },
    [patch],
  );

  /**
   * A box that was typed in but never picked. Commit it only if it *is* a class: `6210` typed
   * by hand is a CAEN, `programare` typed by hand is not, and `479` is a real code at the
   * wrong level. Free text is never stored, which is the mechanical half of „we ship the
   * complete nomenclator, so a code outside it is simply wrong".
   */
  const commitTyped = useCallback(
    (row: CaenRow): CaenRow => {
      if (!isTouched(row)) return { ...row, open: false, active: -1 };
      const typed = row.text.trim();
      if (typed === '') return { ...row, code: '', open: false, active: -1 };
      if (caenClassProblem(typed) === null) {
        return { ...row, code: typed, open: false, active: -1 };
      }
      // Unresolvable text stays visible so the person can fix it, and the row keeps whatever
      // code it already held — silently clearing a saved code on a stray keystroke is data loss.
      return { ...row, open: false, active: -1 };
    },
    [],
  );

  // Report upward whenever the list changes, so the save path can refuse on an unresolved box
  // instead of writing a partial answer.
  useEffect(() => {
    const codes: CaenCode[] = [];
    const problems: string[] = [];
    for (const row of rows) {
      if (!isTouched(row)) {
        // The box still says what the committed code says. For a code the nomenclator does not
        // know — a Rev.2 code inherited from before this dataset shipped — that is the
        // **untouched legacy** case: kept, flagged on the row, and NOT a save blocker. Making it
        // one would mean a person who came in to change their salary could not save until they
        // resolved a classification question they did not ask about, and deleting it on load
        // would be the data loss the schema layer refuses on purpose
        // (`src/domain/schema.ts:61-65`).
        if (row.code !== '') {
          codes.push({ cod: row.code, descriere: caenByCod(row.code)?.denumire ?? '' });
        }
        continue;
      }
      const typed = row.text.trim();
      if (typed === '') continue; // cleared means unanswered, and the old code goes with it
      const problem = caenClassProblem(typed);
      if (problem) {
        // A value the person *typed* is a different case from an inherited one, and that one is
        // refused rather than stored.
        problems.push(problem);
        continue;
      }
      codes.push({ cod: typed, descriere: caenByCod(typed)?.denumire ?? '' });
    }
    onChange({ codes, problems });
  }, [rows, onChange]);

  const filled = rows.filter((r) => r.text.trim() !== '').length;
  const atCap = rows.length >= CAEN_MAX_ACTIVITY_CLASSES;

  const addRow = () => {
    // Refused at the input, not at the save: a person who adds a 6th class and is stopped only
    // when they press „Salvează" has to rediscover the reason at the wrong moment.
    if (atCap) return;
    setRows((prev) => [...prev, blankRow()]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      // Never leave a form with no box at all; index 0 is the principal class and the person
      // may legitimately clear it.
      return next.length === 0 ? [blankRow()] : next;
    });
  };

  // Close the drawdown on a click outside any row, the behaviour a person expects from a
  // combobox and the one a keyboard-only user gets from Escape.
  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setRows((prev) => (prev.some((r) => r.open) ? prev.map((r) => (r.open ? { ...r, open: false } : r)) : prev));
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="caen-list" ref={boxRef}>
      <p className="hint" data-caen-intro>
        {settingsCopy.fiscal.caenClassesIntro}
      </p>

      {rows.map((row, index) => (
        <CaenRowEditor
          key={row.id}
          row={row}
          index={index}
          listId={listId}
          onPatch={patch}
          onPick={pick}
          onCommit={(r) => setRows((prev) => prev.map((x) => (x.id === r.id ? commitTyped(r) : x)))}
          onRemove={() => removeRow(row.id)}
          removable={rows.length > 1 || row.text.trim() !== ''}
        />
      ))}

      <div className="caen-actions">
        <button
          type="button"
          className="btn"
          onClick={addRow}
          disabled={atCap}
          data-caen-add
        >
          {settingsCopy.fiscal.caenAdd}
        </button>
        <span className="hint" data-caen-counter>
          {settingsCopy.fiscal.caenCounter(filled, CAEN_MAX_ACTIVITY_CLASSES)}
        </span>
      </div>

      {atCap ? (
        <div className="caen-cap" data-caen-cap>
          <span className="hint">{settingsCopy.fiscal.caenCapReached}</span>
          <span className="hint caen-citation" data-caen-cap-citation>
            {CAEN_CLASS_CAP_CITATION}
          </span>
        </div>
      ) : null}

      <div className="caen-provenance" data-caen-provenance>
        <Badge kind="info">{CAEN_NOMENCLATOR_VERSION.denumire}</Badge>
        <span className="hint">{settingsCopy.fiscal.caenAttribution}</span>
        <span className="hint">{settingsCopy.fiscal.caenDoesNotSetTax}</span>
      </div>
    </div>
  );
}

function CaenRowEditor({
  row,
  index,
  listId,
  onPatch,
  onPick,
  onCommit,
  onRemove,
  removable,
}: {
  row: CaenRow;
  index: number;
  listId: string;
  onPatch: (id: string, next: Partial<CaenRow>) => void;
  onPick: (id: string, entry: CaenMatch['entry']) => void;
  onCommit: (row: CaenRow) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const inputId = `${listId}-input-${index}`;
  const matches = useMemo(() => (row.open ? searchCaen(row.text) : []), [row.open, row.text]);
  // "Untouched" means the box still says what the committed code says. It is what separates a
  // legacy code the person inherited from a value they just typed, and the two get different
  // treatment: the first is flagged and kept, the second is refused.
  const touched = isTouched(row);
  const problem = touched ? caenClassProblem(row.text) : null;
  const savedNotRev3 = row.code !== '' && !caenByCod(row.code);
  const optionId = (i: number) => `${listId}-option-${index}-${i}`;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!row.open) {
        onPatch(row.id, { open: true, active: 0 });
        return;
      }
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = Math.min(Math.max(row.active + delta, 0), matches.length - 1);
      onPatch(row.id, { active: next });
      return;
    }
    if (event.key === 'Enter') {
      if (row.open && row.active >= 0 && matches[row.active]) {
        event.preventDefault();
        onPick(row.id, matches[row.active].entry);
      } else {
        onCommit(row);
      }
      return;
    }
    if (event.key === 'Escape') {
      onPatch(row.id, { open: false, active: -1 });
    }
  };

  return (
    <div className="caen-row" data-caen-row={index}>
      <div className="caen-row-head">
        <Badge kind={index === 0 ? 'info' : 'neutral'} data-caen-role={index}>
          {index === 0
            ? settingsCopy.fiscal.caenRolePrincipal
            : settingsCopy.fiscal.caenRoleSecondary(index)}
        </Badge>
        <input
          id={inputId}
          className={`input${problem ? ' invalid' : ''}`}
          role="combobox"
          aria-expanded={row.open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={row.active >= 0 ? optionId(row.active) : undefined}
          // A group label names five inputs, which names none of them. Each box gets the group
          // plus its own role, so a screen reader says „Clasele CAEN …, Principală" rather than
          // five identical edit fields.
          aria-label={`${settingsCopy.fiscal.caenClasses} — ${
            index === 0
              ? settingsCopy.fiscal.caenRolePrincipal
              : settingsCopy.fiscal.caenRoleSecondary(index)
          }`}
          autoComplete="off"
          placeholder={settingsCopy.fiscal.caenSearchPlaceholder}
          value={row.text}
          data-caen-input={index}
          onChange={(e) => onPatch(row.id, { text: e.target.value, open: true, active: -1 })}
          onFocus={() => onPatch(row.id, { open: true })}
          onBlur={() => onCommit(row)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onRemove}
          disabled={!removable}
          data-caen-remove={index}
        >
          {settingsCopy.fiscal.caenRemove}
        </button>
      </div>

      {problem ? <span className="error" data-caen-error={index}>{problem}</span> : null}
      {!problem && savedNotRev3 ? (
        <span className="hint" data-caen-stale={index}>
          {settingsCopy.fiscal.caenNotRev3}
        </span>
      ) : null}

      {row.open ? (
        <div className="caen-options" id={listId} role="listbox" data-caen-options>
          {matches.length === 0 ? (
            <div className="caen-empty" data-caen-empty>
              {settingsCopy.fiscal.caenNoResults}
              <span className="hint">{settingsCopy.fiscal.caenOnlyClass}</span>
            </div>
          ) : (
            matches.map((match, i) => (
              <div
                key={match.entry.cod}
                id={optionId(i)}
                role={match.selectable ? 'option' : 'presentation'}
                aria-selected={match.selectable && row.code === match.entry.cod}
                className={`caen-option${match.selectable ? '' : ' caen-option-header'}${
                  row.active === i ? ' caen-option-active' : ''
                }`}
                data-caen-selectable={match.selectable}
                data-caen-code={match.entry.cod}
                onMouseDown={(e) => {
                  // mousedown, not click: the input's blur fires first and would commit and
                  // close the list before the click ever lands.
                  if (!match.selectable) return;
                  e.preventDefault();
                  onPick(row.id, match.entry);
                }}
                onMouseEnter={() => onPatch(row.id, { active: i })}
              >
                <span className="caen-option-label">{caenLabel(match.entry)}</span>
                {match.selectable ? (
                  <span className="caen-option-lineage">{caenLineageLabel(match.entry.cod)}</span>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
