import { useState } from 'react';
import type { Bill, Colleague, PaymentMethod, StaffRole } from '../types';
import { collectBill, confirmBill, fetchColleagues, handoverBill, moveBill, requestBill } from '../services/billService';
import { markWalkout } from '../services/problemService';
import { formatPrice } from '../utils/currency';
import { t } from '../i18n/en';
import { BusyButton } from './Loading';
import { MoreHorizontal } from 'lucide-react';

interface BillCardProps {
  bill: Bill;
  role: StaffRole | null;
  currency?: string;
  /** Called after any change so the screen reloads its bills. */
  onChanged: (bill?: Bill) => void;
  /** False inside a table's card, where the table name is already the heading. */
  showTable?: boolean;
  /** Tables offered when moving or joining the bill; any other name can still be typed. */
  tableSuggestions?: string[];
  /**
   * Inside a waiter's table card: a lighter look, and the less common actions (move, hand over,
   * walkout) behind "More" so the phone shows one short row of buttons.
   */
  inset?: boolean;
}

type Panel = 'none' | 'collect' | 'move' | 'handover' | 'walkout';

const METHODS: PaymentMethod[] = ['cash', 'telebirr', 'cbe_birr_bank'];

/** One bill with what was paid and what is owed, and the actions the signed-in role may take. */
export default function BillCard({ bill, role, currency = 'ETB', onChanged, showTable = true, tableSuggestions = [], inset = false }: BillCardProps) {
  const [showMore, setShowMore] = useState(false);
  const [panel, setPanel] = useState<Panel>('none');
  const [amount, setAmount] = useState(String(bill.amount_owed));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [table, setTable] = useState('');
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [handoverTo, setHandoverTo] = useState('');
  // Which action is running ('ask', 'confirm', 'save', 'walkout'), so only its button spins
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const busy = busyAction !== null;
  const [error, setError] = useState<string | null>(null);

  const serves = role === 'waiter' || role === 'manager' || role === 'super_admin';
  const confirms = role === 'cashier' || role === 'manager' || role === 'super_admin';
  const takesOrders = bill.status === 'open' || bill.status === 'bill_requested';
  const money = (v: number) => formatPrice(v, currency);
  const moveOptions = tableSuggestions.filter((name) => name !== bill.table_number);

  const run = async (action: () => Promise<Bill>, key = 'save') => {
    setBusyAction(key);
    setError(null);
    try {
      const updated = await action();
      setPanel('none');
      onChanged(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusyAction(null);
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

  // The less common actions: always shown on a full bill card, behind "More" inside a table card
  const hasMore = serves && (takesOrders || bill.status === 'collected');
  const moreOpen = !inset || showMore || panel === 'move' || panel === 'handover' || panel === 'walkout';

  return (
    <div data-testid={`bill-${bill.id}`} className={`bill-card ${inset ? 'bill-card-inset' : ''}`}>
      <div className="bill-card-head">
        <strong className="bill-card-title">{showTable ? t.kitchen.table(bill.table_number) : t.bills.heading}</strong>
        <span className={`bill-status bill-status-${bill.status}`}>{t.bills.status[bill.status]}</span>
      </div>
      <div className="bill-card-waiter">{t.bills.waiter(bill.waiter_name)}</div>
      <div className="bill-amounts">
        <span>
          <span className="bill-amount-label">{t.bills.total}</span>
          <strong>{money(bill.total_amount)}</strong>
        </span>
        <span>
          <span className="bill-amount-label">{t.bills.paid}</span>
          <strong>{money(bill.amount_paid)}</strong>
        </span>
        {bill.amount_owed > 0 && (
          <span className="bill-amount-owed">
            <span className="bill-amount-label">{t.bills.owed}</span>
            <strong>{money(bill.amount_owed)}</strong>
          </span>
        )}
      </div>
      {bill.payments.length > 0 && (
        <ul className="bill-payments">
          {bill.payments.map((p) => (
            <li key={p.id}>
              <span className={`bill-method bill-method-${p.method}`}>{t.bills.methods[p.method]}</span>
              <strong>{money(p.amount)}</strong>
              <span className="bill-payment-by">
                {p.collected_by_name}
                {p.reference && ` · ${p.reference}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="admin-bill-actions" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {serves && bill.status === 'open' && (
          <BusyButton className="admin-sec-pill-btn" busy={busyAction === 'ask'} disabled={busy} onClick={() => run(() => requestBill(bill.id), 'ask')}>
            {t.bills.askBill}
          </BusyButton>
        )}
        {serves && takesOrders && bill.amount_owed > 0 && (
          <button type="button" className="admin-save-pill-btn" disabled={busy} onClick={() => openPanel('collect')}>
            {t.bills.collect}
          </button>
        )}
        {hasMore && inset && !moreOpen && (
          <button type="button" className="admin-sec-pill-btn" aria-expanded={false} onClick={() => setShowMore(true)}>
            <MoreHorizontal size={14} /> {t.bills.more}
          </button>
        )}
        {moreOpen && serves && takesOrders && (
          <button type="button" className="admin-sec-pill-btn" disabled={busy} onClick={() => openPanel('move')}>
            {t.bills.move}
          </button>
        )}
        {moreOpen && serves && (takesOrders || bill.status === 'collected') && (
          <button type="button" className="admin-sec-pill-btn" disabled={busy} onClick={() => openPanel('handover')}>
            {t.bills.handover}
          </button>
        )}
        {moreOpen && serves && takesOrders && bill.amount_owed > 0 && (
          <button type="button" className="admin-sec-pill-btn" style={{ color: '#b91c1c' }} disabled={busy} onClick={() => openPanel('walkout')}>
            {t.walkouts.mark}
          </button>
        )}
        {confirms && bill.status === 'collected' && (
          <BusyButton className="admin-save-pill-btn" busy={busyAction === 'confirm'} disabled={busy} onClick={() => run(() => confirmBill(bill.id), 'confirm')}>
            {t.bills.confirm}
          </BusyButton>
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
              <span style={{ fontSize: '13px', color: '#64748b' }}>{t.bills.referenceHint}</span>
            </div>
          )}
          <BusyButton type="submit" className="admin-save-pill-btn" busy={busyAction === 'save'} disabled={busy}>
            {t.bills.save}
          </BusyButton>
        </form>
      )}

      {panel === 'walkout' && (
        <div role="group" aria-label={t.walkouts.mark} style={{ display: 'grid', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>{t.walkouts.confirmMark(bill.table_number, money(bill.amount_owed))}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <BusyButton
              className="admin-save-pill-btn"
              style={{ backgroundColor: '#b91c1c' }}
              busy={busyAction === 'walkout'}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await markWalkout(bill.id);
                  return { ...bill, status: 'walkout' };
                }, 'walkout')
              }
            >
              {t.walkouts.mark}
            </BusyButton>
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
          <input
            className="admin-input-control"
            aria-label={t.bills.moveTo}
            placeholder={t.bills.moveTo}
            value={table}
            onChange={(e) => setTable(e.target.value)}
            list={moveOptions.length > 0 ? `move-tables-${bill.id}` : undefined}
          />
          {moveOptions.length > 0 && (
            <datalist id={`move-tables-${bill.id}`}>
              {moveOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}
          <BusyButton type="submit" className="admin-save-pill-btn" busy={busyAction === 'save'} disabled={busy || !table.trim()}>
            {t.bills.save}
          </BusyButton>
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
          <BusyButton type="submit" className="admin-save-pill-btn" busy={busyAction === 'save'} disabled={busy || !handoverTo}>
            {t.bills.save}
          </BusyButton>
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
