import type { ReactNode } from 'react';

/**
 * TASK 7 acceptance 5 — a real disclosure control, never a hover.
 *
 * Native `<details>` / `<summary>` is chosen deliberately: it is keyboard-operable with no script,
 * its open/closed state is visible and announced, and its content stays in the DOM when closed, so a
 * person who never touches a pointer still reaches it. A `title=` tooltip or a CSS `:hover` reveal
 * would fail this acceptance and is not an option here.
 *
 * The caption is always copy from `src/ui/copy` — „Cum am ajuns la această sumă" or „Surse și note
 * de interpretare" — never a string written at the call site.
 */
export interface DisclosureProps {
  /** The caption on the control. From the copy layer. */
  label: string;
  children: ReactNode;
  /** Opens the disclosure on first render. Off by default: the detail is collapsed, not hidden. */
  defaultOpen?: boolean;
  className?: string;
  id?: string;
}

export function Disclosure({ label, children, defaultOpen = false, className, id }: DisclosureProps) {
  return (
    <details
      className={className ? `disclosure ${className}` : 'disclosure'}
      id={id}
      open={defaultOpen}
    >
      <summary className="disclosure-summary">{label}</summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
