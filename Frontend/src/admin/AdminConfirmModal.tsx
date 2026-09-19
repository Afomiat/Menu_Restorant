import { AlertTriangle, Trash2 } from 'lucide-react';

interface AdminConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemName?: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function AdminConfirmModal({
  isOpen,
  title,
  message,
  itemName,
  confirmLabel = 'Delete',
  isDestructive = true,
  onConfirm,
  onClose,
}: AdminConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-dialog"
        style={{ maxWidth: '440px', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ padding: '28px 24px 20px 24px', textAlign: 'center' }}>
          {/* Warning / Destructive Icon Circle */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: isDestructive ? '#fee2e2' : 'var(--admin-primary-light)',
              color: isDestructive ? '#ef4444' : 'var(--admin-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}
          >
            {isDestructive ? <Trash2 size={26} /> : <AlertTriangle size={26} />}
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--admin-text-main)', margin: '0 0 8px 0' }}>
            {title}
          </h3>

          <p style={{ fontSize: '14px', color: 'var(--admin-text-muted)', lineHeight: 1.5, margin: 0 }}>
            {message}
          </p>

          {itemName && (
            <div
              style={{
                marginTop: '12px',
                padding: '8px 12px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--admin-text-main)',
                border: '1px solid var(--admin-border)',
                wordBreak: 'break-word',
              }}
            >
              "{itemName}"
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div
          className="admin-modal-footer"
          style={{ justifyContent: 'center', gap: '12px', backgroundColor: '#f8fafc' }}
        >
          <button
            type="button"
            className="admin-sec-pill-btn"
            style={{ flex: 1, height: '44px', justifyContent: 'center' }}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="admin-save-pill-btn"
            style={{
              flex: 1,
              height: '44px',
              justifyContent: 'center',
              backgroundColor: isDestructive ? '#ef4444' : 'var(--admin-primary)',
            }}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {isDestructive && <Trash2 size={15} />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
