import type { ReactNode } from 'react';

/**
 * Presentational card primitives (Step 22).
 *
 * Styled with the existing design-system classes from styles.css
 * (`.card`, `.card-header`, `.card-body`). No data access.
 */

/** Card shell — wraps children in a `.card-body` grid. */
export function Card({ children, flush }: { children: ReactNode; flush?: boolean }) {
  return (
    <section className="card">
      <div className={`card-body${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  );
}

/** Card header block. */
export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="card-header">{children}</div>;
}

/** Card title (h3). */
export function CardTitle({ children }: { children: ReactNode }) {
  return <h3>{children}</h3>;
}

/** Card description (muted hint text). */
export function CardDescription({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>;
}
