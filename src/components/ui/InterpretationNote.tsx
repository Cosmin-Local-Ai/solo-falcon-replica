import { noteLabel } from '../../ui/copy';

/**
 * TASK 7 acceptance 4 — the one shape every uncertainty takes on screen.
 *
 * Where the law does not settle something, the app says so once, in one plain sentence that names
 * both halves: what the law does not state, and what the app does about it. Before this component
 * the same situation was worded eight different ways across TASK 5, again for the art. 68 alin. (6)
 * pre-cap/post-cap choice from TASK 2d, and again for the 10 % warning band from TASK 4.
 *
 * Two rules the component enforces by construction:
 * - the label is the copy-layer constant, so no site renames it;
 * - `note` is one sentence from `copy.notes.*`. A note may explain an uncertainty; it may never
 *   resolve one. If a note would make a withheld conclusion read as decided, the note is wrong.
 *
 * `citation` keeps the article on screen. A digest is not a citation and never replaces one (TASK 9).
 */
export interface InterpretationNoteProps {
  /** One plain sentence: what the law does not state, and what the app does about it. */
  note: string;
  /** The provision the note rests on, kept visible. Optional when there is nothing to cite. */
  citation?: string;
  /** Stable id so a disclosure or a test can point at the note. */
  id?: string;
  className?: string;
}

export function InterpretationNote({ note, citation, id, className }: InterpretationNoteProps) {
  return (
    <div
      className={className ? `interpretation-note ${className}` : 'interpretation-note'}
      data-note="interpretare"
      role="note"
      id={id}
    >
      <span className="interpretation-note__label">{noteLabel}</span>
      <span className="interpretation-note__text">{note}</span>
      {citation ? <span className="interpretation-note__citation">{citation}</span> : null}
    </div>
  );
}
