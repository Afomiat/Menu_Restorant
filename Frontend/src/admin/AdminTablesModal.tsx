import { useState, useEffect } from 'react';
import { X, QrCode, Plus, Check, Copy, ExternalLink, Printer, Loader2 } from 'lucide-react';
import { fetchAdminTables, createAdminTable, generateAdminTableQR, type AdminTable } from '../services/orderService';

interface AdminTablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantSlug: string;
}

export default function AdminTablesModal({
  isOpen,
  onClose,
  restaurantSlug: _restaurantSlug,
}: AdminTablesModalProps) {
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Selected table for QR display
  const [selectedTable, setSelectedTable] = useState<AdminTable | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchAdminTables()
        .then((data) => {
          setTables(data);
          if (data.length > 0 && !selectedTable) {
            handleSelectTable(data[0]);
          }
        })
        .catch((err) => console.warn('Failed to load tables:', err))
        .finally(() => setLoading(false));
    } else {
      setSelectedTable(null);
      setQrUrl(null);
      setNewTableNumber('');
      setCreateError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectTable = async (table: AdminTable) => {
    setSelectedTable(table);
    setIsGeneratingQR(true);
    setCopied(false);
    try {
      const res = await generateAdminTableQR(table.table_number);
      const fullUrl = `${window.location.origin}${res.qr_url}`;
      setQrUrl(fullUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate QR';
      console.warn(msg);
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTableNumber.trim();
    if (!trimmed) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await createAdminTable(trimmed);
      setTables((prev) => [...prev, created]);
      setNewTableNumber('');
      handleSelectTable(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add table';
      setCreateError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = () => {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-dialog"
        style={{ maxWidth: '640px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="admin-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={20} color="var(--admin-primary)" />
            <h3 className="admin-modal-title">Dining Tables & QR Codes</h3>
          </div>
          <button
            type="button"
            className="admin-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Add New Table Form */}
          <form onSubmit={handleCreateTable} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              className="admin-input-control"
              style={{ flex: 1 }}
              placeholder="Enter new table number (e.g. 6, Patio-2, Bar-1)"
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
              disabled={isCreating}
            />
            <button
              type="submit"
              className="admin-save-pill-btn"
              disabled={isCreating || !newTableNumber.trim()}
              style={{
                height: '42px',
                padding: '0 16px',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--admin-primary)',
              }}
            >
              {isCreating ? <Loader2 size={16} className="admin-spin" /> : <Plus size={16} />}
              Add Table
            </button>
          </form>

          {createError && (
            <div style={{ color: 'var(--admin-danger)', fontSize: '12px', marginTop: '-10px' }}>
              {createError}
            </div>
          )}

          {/* Tables Selection Grid */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--admin-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Registered Dining Tables ({tables.length})
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--admin-text-muted)' }}>
                <Loader2 size={20} className="admin-spin" style={{ margin: '0 auto 8px' }} />
                Loading restaurant tables...
              </div>
            ) : tables.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--admin-text-muted)', fontSize: '13px' }}>
                No tables registered yet. Add your first table above!
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '130px', overflowY: 'auto', padding: '4px 0' }}>
                {tables.map((t) => {
                  const isSelected = selectedTable?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTable(t)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        border: isSelected ? '1.5px solid var(--admin-primary)' : '1px solid var(--admin-border)',
                        backgroundColor: isSelected ? 'var(--admin-primary-light, rgba(255, 90, 54, 0.1))' : '#ffffff',
                        color: isSelected ? 'var(--admin-primary)' : 'var(--admin-text-main)',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Table {t.table_number}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* QR Code Preview & Action Box */}
          {selectedTable && (
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid var(--admin-border)',
                backgroundColor: '#f8fafc',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-text-main)' }}>
                QR Code for Table {selectedTable.table_number}
              </div>

              {isGeneratingQR ? (
                <div style={{ padding: '40px', color: 'var(--admin-text-muted)' }}>
                  <Loader2 size={24} className="admin-spin" />
                  <div style={{ fontSize: '12px', marginTop: '8px' }}>Generating HMAC Token...</div>
                </div>
              ) : qrUrl ? (
                <>
                  <div
                    style={{
                      background: '#ffffff',
                      padding: '12px',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                      display: 'inline-block',
                    }}
                  >
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`}
                      alt={`Table ${selectedTable.table_number} QR`}
                      style={{ width: '180px', height: '180px', display: 'block' }}
                    />
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)', wordBreak: 'break-all', maxWidth: '100%', padding: '0 8px' }}>
                    {qrUrl}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="admin-sec-pill-btn"
                      onClick={handleCopyLink}
                      style={{ height: '36px', fontSize: '12px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {copied ? <Check size={14} color="var(--admin-success, #10b981)" /> : <Copy size={14} />}
                      {copied ? 'Copied Link!' : 'Copy Dine-In Link'}
                    </button>

                    <button
                      type="button"
                      className="admin-sec-pill-btn"
                      onClick={() => window.open(qrUrl, '_blank')}
                      style={{ height: '36px', fontSize: '12px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <ExternalLink size={14} />
                      Test Link
                    </button>

                    <button
                      type="button"
                      className="admin-sec-pill-btn"
                      onClick={() => window.print()}
                      style={{ height: '36px', fontSize: '12px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Printer size={14} />
                      Print Sticker
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="admin-modal-footer">
          <button type="button" className="admin-sec-pill-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
