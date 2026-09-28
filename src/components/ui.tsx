import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../data/store';

export function Card({ title, action, children, flush }: {
  title?: string; action?: ReactNode; children: ReactNode; flush?: boolean;
}) {
  return (
    <div className="card">
      {title && (
        <div className="card-header">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      <div className={`card-body${flush ? ' flush' : ''}`}>{children}</div>
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: {
  label: string; value: string; hint?: string; tone?: 'pos' | 'neg';
}) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ''}`}>{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`badge ${kind}`}><span className="badge-dot" />{children}</span>;
}

export function Modal({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-lg' : ''}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Închide">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: {
  icon?: string; title: string; text?: string; action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="icon">{icon ?? '🗂'}</div>
      <h4>{title}</h4>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;
  const icons = { success: '✓', error: '✕', info: 'ℹ' } as const;
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => dismissToast(t.id)}>
          <span className="t-icon">{icons[t.kind]}</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, total, onPage }: {
  page: number; pages: number; total: number; onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <span className="page-info">{total} înregistrări</span>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
      {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
        <button key={p} className={p === page ? 'current' : ''} onClick={() => onPage(p)}>{p}</button>
      ))}
      <button disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button>
    </div>
  );
}
