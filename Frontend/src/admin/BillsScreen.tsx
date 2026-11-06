import { useCallback, useEffect, useState } from 'react';
import type { Bill, StaffRole } from '../types';
import { fetchBills } from '../services/billService';
import BillCard from './BillCard';
import ShiftBar from './ShiftBar';
import PushButton from './PushButton';
import { t } from '../i18n/en';

interface BillsScreenProps {
  role: StaffRole | null;
  currency?: string;
  /** Changes when a bill or order changes, so the screen reloads. */
  refreshSignal: number;
  /** Cashiers work in shifts; managers do not need the shift bar. */
  showShift?: boolean;
}

/** Cashiers and managers (Pro): collected bills to confirm first, then open bills, then today's confirmed ones. */
export default function BillsScreen({ role, currency, refreshSignal, showShift = false }: BillsScreenProps) {
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchBills()
      .then((data) => {
        setBills(data);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load bills'));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const sections: { title: string; items: Bill[] }[] = [
    { title: t.bills.sectionCollected, items: (bills || []).filter((b) => b.status === 'collected') },
    { title: t.bills.sectionOpen, items: (bills || []).filter((b) => b.status === 'open' || b.status === 'bill_requested') },
    { title: t.bills.sectionConfirmed, items: (bills || []).filter((b) => b.status === 'confirmed' || b.status === 'walkout') },
  ];

  return (
    <section className="admin-kitchen-page-view" aria-label={t.bills.title}>
      <h1 className="admin-top-title" style={{ margin: '0 0 12px' }}>{t.bills.title}</h1>
      {showShift && <ShiftBar role={role} currency={currency} />}
      <PushButton />
      {error && <p role="status" style={{ color: '#dc2626', fontSize: '13px' }}>{error}</p>}
      {sections.map((section) => (
        <div key={section.title} style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', margin: '0 0 8px', color: '#334155' }}>
            {section.title} ({section.items.length})
          </h2>
          {section.items.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>{t.bills.none}</p>
          ) : (
            <div className="admin-kitchen-tickets-grid">
              {section.items.map((bill) => (
                <BillCard key={bill.id} bill={bill} role={role} currency={currency} onChanged={load} />
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
