import type { ReactNode } from 'react';

interface AdminPageShellProps {
  title: string;
  subtitle?: string;
  /** How wide the content may grow; forms read better narrower than lists. */
  maxWidth?: number;
  /** The page lays out its own panels instead of sitting in one white panel. */
  bare?: boolean;
  children: ReactNode;
}

/** A full page in the dashboard (like Bills or Reports): a heading and one white panel. */
export default function AdminPageShell({ title, subtitle, maxWidth = 960, bare = false, children }: AdminPageShellProps) {
  return (
    <section className="admin-kitchen-page-view" aria-label={title}>
      <div>
        <h1 className="admin-top-title" style={{ margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>{subtitle}</p>}
      </div>
      {bare ? (
        <div style={{ maxWidth: `${maxWidth}px`, width: '100%', display: 'grid', gap: '16px' }}>{children}</div>
      ) : (
        <div className="admin-page-panel" style={{ maxWidth: `${maxWidth}px` }}>
          {children}
        </div>
      )}
    </section>
  );
}
