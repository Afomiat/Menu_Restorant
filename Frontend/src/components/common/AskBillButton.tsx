import { Receipt } from 'lucide-react';
import { t } from '../../i18n/en';

interface AskBillButtonProps {
  onAsk: () => void;
  asked: boolean;
  error?: string | null;
}

/** The customer's "Ask for the bill" button (Pro); after asking it says the waiter is coming. */
export default function AskBillButton({ onAsk, asked, error }: AskBillButtonProps) {
  return (
    <div style={{ display: 'grid', gap: '6px', margin: '10px 0' }}>
      {asked ? (
        <p role="status" style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#15803d', textAlign: 'center' }}>
          {t.customerBill.asked}
        </p>
      ) : (
        <button
          type="button"
          onClick={onAsk}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: '999px',
            border: 'none',
            background: '#0f172a',
            color: '#fff',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <Receipt size={16} /> {t.customerBill.ask}
        </button>
      )}
      {error && (
        <p role="alert" style={{ margin: 0, color: '#dc2626', fontSize: '12px', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}
