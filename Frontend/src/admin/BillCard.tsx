import { useState } from 'react';
import type { Bill, Colleague, PaymentMethod, StaffRole } from '../types';
import { collectBill, confirmBill, fetchColleagues, handoverBill, moveBill, requestBill } from '../services/billService';
import { markWalkout } from '../services/problemService';
import { formatPrice } from '../utils/currency';
import { t } from '../i18n/en';

interface BillCardProps {
  bill: Bill;
  role: StaffRole | null;
  currency?: string;
  /** Called after any change so the screen reloads its bills. */
  onChanged: (bill?: Bill) => void;
}

type Panel = 'none' | 'collect' | 'move' | 'handover' | 'walkout';

const METHODS: PaymentMethod[] = ['cash', 'telebirr', 'cbe_birr_bank'];

/** One bill with what was paid and what is owed, and the actions the signed-in role may take. */
export default function BillCard({ bill, role, currency = 'ETB', onChanged }: BillCardProps) {
  const [panel, setPanel] = useState<Panel>('none');
  const [amount, setAmount] = useState(String(bill.amount_owed));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [table, setTable] = useState('');
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [handoverTo, setHandoverTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serves = role === 'waiter' || role === 'manager' || role === 'super_admin';
  const confirms = role === 'cashier' || role === 'manager' || role === 'super_admin';
  const takesOrders = bill.status === 'open' || bill.status === 'bill_requested';
  const money = (v: number) => formatPrice(v, currency);

  const run = async (action: () => Promise<Bill>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      setPanel('none');
      onChanged(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const openPanel = (next: Panel) => {
    setError(null);
    setPanel(panel === next ? 'none' : next);
    if (next === 'collect') setAmount(String(bill.amount_owed));
    if (next === 'handover' && colleagues.length === 0) {
      fetchColleagues()
        .then((list) => setColleagues(list.filter((c) => c.id !== bill.waiter_id)))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed'));
    }
  };

  return (
    <div data-testid={`bill-${bill.id}`} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fff', display: 'grid', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <strong>{t.kitchen.table(bill.table_number)}</strong>
        <span style={{ fontSize: '12px', fontWeight: 800, color: bill.status === 'bill_requested' ? '#b45309' : '#475569' }}>
          {t.bills.status[bill.status]}
        </span>
      </div>
      <div style={{ fontSize: '13px', color: '#64748b' }}>{t.bills.waiter(bill.waiter_name)}</div>
      <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
        <span>
          {t.bills.total}: <strong>{money(bill.total_amount)}</strong>
        </span>
        <span>
          {t.bills.paid}: {money(bill.amount_paid)}
        </span>
        {bill.amount_owed > 0 && (
          <span style={{ color: '#b45309' }}>
            {t.bills.owed}: <strong>{money(bill.amount_owed)}</strong>
          </span>
        )}
      </div>
      {bill.payments.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569' }}>
          {bill.payments.map((p) => (
            <li key={p.id}>
              {money(p.amount)} · {t.bills.collectedBy(p.collected_by_name, t.bills.methods[p.method])}
              {p.reference && ` · ${p.reference}`}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {serves && bill.status === 'open' && (
          <button type="button" className="admin-sec-pill-btn" disabled={busy} onClick={() => run(() => requestBill(bill.id))}>
            {t.bills.askBill}
          </button>
        )}
        {serves && takesOrders && bill.amount_owed > 0 && (
          <button type="button" className="admin-save-pill-btn" disabled={busy} onClick={() => openPanel('collect')}>
            {t.bills.collect}
          </button>
        )}
        {serves && takesOrders && (
          <button type="button" className="admin-sec-pill-btn" disabled={busy} onClick={() => openPanel('move')}>
            {t.bills.move}
          </button>
        )}
        {serves && (takesOrders || bill.status === 'collected') && (
          <button type="button" className="admin-sec-pill-btn" disabled={busy} onClick={() => openPanel('handover')}>
            {t.bills.handover}
          </button>
        )}
        {serves && takesOrders && bill.amount_owed > 0 && (
          <button type="button" className="admin-sec-pill-btn" style={{ color: '#b91c1c' }} disabled={busy} onClick={() => openPanel('walkout')}>
            {t.walkouts.mark}
          </button>
        )}
        {confirms && bill.status === 'collected' && (
          <button type="button" className="admin-save-pill-btn" disabled={busy} onClick={() => run(() => confirmBill(bill.id))}>
            {t.bills.confirm}
          </button>
        )}
      </div>

      {panel === 'collect' && (
        <form
          aria-label={t.bills.collectTitle(bill.table_number)}
          style={{ display: 'grid', gap: '8px' }}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => collectBill(bill.id, { amount: Number(amount), method, reference: method === 'cash' ? '' : reference }));
          }}
        >
          <label className="admin-input-label">
            {t.bills.amount}
            <input className="admin-input-control" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="admin-input-label">
            {t.bills.method}
            <select className="admin-input-control" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {t.bills.methods[m]}
                </option>
              ))}
            </select>
          </label>
          {method !== 'cash' && (
            <div>
              <label className="admin-input-label">
                {t.bills.reference}
                <input className="admin-input-control" maxLength={64} value={reference} onChange={(e) => setReference(e.target.value)} />
              </label>
              <span style={{ fontSize: '11px', color: '#64748b' }}>{t.bills.referenceHint}</span>
            </div>
          )}
          <button type="submit" className="admin-save-pill-btn" disabled={busy}>
            {t.bills.save}
          </button>
        </form>
      )}

      {panel === 'walkout' && (
        <div role="group" aria-label={t.walkouts.mark} style={{ display: 'grid', gap: '6px' }}>
          <span style={{ fontSize: '13px' }}>{t.walkouts.confirmMark(bill.table_number, money(bill.amount_owed))}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="admin-save-pill-btn"
              style={{ backgroundColor: '#b91c1c' }}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await markWalkout(bill.id);
                  return { ...bill, status: 'walkout' };
                })
              }
            >
              {t.walkouts.mark}
            </button>
            <button type="button" className="admin-sec-pill-btn" onClick={() => setPanel('none')}>
              {t.bills.cancel}
            </button>
          </div>
        </div>
      )}

      {panel === 'move' && (
        <form
          aria-label={t.bills.move}
          style={{ display: 'flex', gap: '8px' }}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => moveBill(bill.id, table.trim()));
          }}
        >
          <input className="admin-input-control" aria-label={t.bills.moveTo} placeholder={t.bills.moveTo} value={table} onChange={(e) => setTable(e.target.value)} />
          <button type="submit" className="admin-save-pill-btn" disabled={busy || !table.trim()}>
            {t.bills.save}
          </button>
        </form>
      )}

      {panel === 'handover' && (
        <form
          aria-label={t.bills.handover}
          style={{ display: 'flex', gap: '8px' }}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => handoverBill(bill.id, handoverTo));
          }}
        >
          <select className="admin-input-control" aria-label={t.bills.handoverTo} value={handoverTo} onChange={(e) => setHandoverTo(e.target.value)}>
            <option value="">{t.bills.handoverTo}</option>
            {colleagues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} ({t.roles[c.role]})
              </option>
            ))}
          </select>
          <button type="submit" className="admin-save-pill-btn" disabled={busy || !handoverTo}>
            {t.bills.save}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
