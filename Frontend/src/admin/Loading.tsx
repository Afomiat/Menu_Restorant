import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/** A small turning circle, the same everywhere in the dashboard. */
export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="admin-spin" aria-hidden="true" />;
}

interface BusyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** While true the button shows a spinner (in place of its icon) and cannot be pressed again. */
  busy?: boolean;
  icon?: ReactNode;
}

/** A button that shows its action is running, so it is not pressed twice. */
export function BusyButton({ busy = false, icon, disabled, children, type = 'button', ...rest }: BusyButtonProps) {
  return (
    <button type={type} {...rest} disabled={busy || disabled} aria-busy={busy || undefined}>
      {busy ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
}

type SkeletonSection = { kind: 'cards'; count: number } | { kind: 'rows'; count: number } | { kind: 'panel'; lines: number };

/**
 * Grey shapes in place of a page's content while its data loads, so the page never
 * flashes empty ("Nothing here") or half-built before the real content arrives.
 */
export function SkeletonBlocks({ kpis = 0, sections = [], label = 'Loading' }: { kpis?: number; sections?: SkeletonSection[]; label?: string }) {
  return (
    <div className="sk-wrap" role="status" aria-label={label} aria-busy="true">
      {kpis > 0 && (
        <div className="rpt-kpis">
          {Array.from({ length: kpis }, (_, i) => (
            <div key={i} className="rpt-kpi">
              <span className="sk sk-line" style={{ width: '45%' }} />
              <span className="sk sk-big" style={{ width: '60%' }} />
              <span className="sk sk-line" style={{ width: '35%' }} />
            </div>
          ))}
        </div>
      )}
      {sections.map((section, i) =>
        section.kind === 'cards' ? (
          <div key={i} className="admin-kitchen-tickets-grid">
            {Array.from({ length: section.count }, (_, j) => (
              <div key={j} className="bill-card">
                <span className="sk sk-line" style={{ width: '40%', height: 16 }} />
                <span className="sk sk-line" style={{ width: '55%' }} />
                <span className="sk sk-big" style={{ width: '70%' }} />
                <span className="sk sk-pill" />
              </div>
            ))}
          </div>
        ) : section.kind === 'rows' ? (
          <div key={i} className="rpt-panel sk-rows">
            {Array.from({ length: section.count }, (_, j) => (
              <div key={j} className="sk-row">
                <span className="sk sk-line" style={{ width: `${30 + ((j * 17) % 30)}%` }} />
                <span className="sk sk-line" style={{ width: '18%' }} />
              </div>
            ))}
          </div>
        ) : (
          <div key={i} className="rpt-panel sk-rows">
            <span className="sk sk-line" style={{ width: '30%', height: 16 }} />
            {Array.from({ length: section.lines }, (_, j) => (
              <span key={j} className="sk sk-line" style={{ width: `${55 + ((j * 23) % 40)}%` }} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

/** The whole dashboard while the restaurant loads: the sidebar's place and a page outline. */
export function DashboardSkeleton() {
  return (
    <div className="admin-layout-root" role="status" aria-label="Loading the dashboard" aria-busy="true">
      <aside className="admin-sidebar sk-sidebar">
        <span className="sk sk-big" style={{ width: '70%' }} />
        <div className="sk-rows" style={{ marginTop: 32 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="sk sk-line" style={{ width: `${50 + ((i * 13) % 35)}%`, height: 14 }} />
          ))}
        </div>
      </aside>
      <main className="admin-main-viewport">
        <span className="sk sk-big" style={{ width: 220, height: 32, marginBottom: 24 }} />
        <SkeletonBlocks kpis={3} sections={[{ kind: 'cards', count: 6 }]} />
      </main>
    </div>
  );
}
