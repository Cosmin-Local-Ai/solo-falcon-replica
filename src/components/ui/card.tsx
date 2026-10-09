import type { ReactNode } from 'react';

/**
 * Presentational card primitives (Step 22), unified in TASK 9.
 *
 * Styled with the existing design-system classes from styles.css
 * (`.card`, `.card-header`, `.card-body`). No data access.
 *
 * Before TASK 9 there were three card shells: this one, `SectionCard` in `pages/Dashboard.tsx`, and
 * `Card` in `components/ui.tsx`. They emitted different markup — `.card-head` against `.card-header`, a
 * bare `<h3>` against `<h2 className="card-title">` — and because this one put its `CardHeader` *inside*
 * `.card-body` while the other two put the header beside it, one card carried 18px + 14px/18px of
 * padding where another carried 14px/18px, and a card title rendered at 15px or 14px depending on which
 * file wrote it. All three now emit the same structure: a `.card-header` sibling of a `.card-body`, with
 * the title carrying `.card-title`.
 */

export interface CardProps {
  /** Rendered as a sibling of the body, never inside it — that is what makes the padding one value. */
  header?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}

/** Card shell — a `.card-header` (optional) beside a `.card-body` grid. */
export function Card({ header, children, flush }: CardProps) {
  return (
    <section className="card">
      {header}
      <div className={`card-body${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  );
}

/** Card header block. */
export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="card-header">{children}</div>;
}

/**
 * Card title. `h2` is the default because every card this renders is a section of its page, under the
 * page's single `h1`. `h3` is for a card nested inside another card — the legislation item cards sit
 * under the Legislație card — and nothing else passes it.
 */
export interface CardTitleProps {
  children: ReactNode;
  level?: 'h2' | 'h3';
}

export function CardTitle({ children, level = 'h2' }: CardTitleProps) {
  return level === 'h3' ? (
    <h3 className="card-title">{children}</h3>
  ) : (
    <h2 className="card-title">{children}</h2>
  );
}

/** Card description (muted hint text). */
export function CardDescription({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>;
}
