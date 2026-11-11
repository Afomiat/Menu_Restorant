import { Ban } from 'lucide-react';
import { t } from '../i18n/en';

/** Opens the sold-out list from the chef's and the waiter's screens. */
export default function SoldOutButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" className="admin-sec-pill-btn" onClick={onClick} title={t.kitchen.soldOutHint} style={{ whiteSpace: 'nowrap' }}>
      <Ban size={14} /> {t.kitchen.soldOut(count)}
    </button>
  );
}
