import { useState, useEffect } from 'react';
import { X, QrCode, Plus, Check, Copy, ExternalLink, Printer, Loader2, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { fetchAdminTables, createAdminTable, generateAdminTableQR, assignTableWaiter, type AdminTable } from '../services/orderService';
import { fetchStaff } from '../services/staffService';
import type { PlanTier, StaffMember } from '../types';
import { hasPlan } from '../utils/plan';
import { t as text } from '../i18n/en';
import { tableLabel } from '../utils/table';

interface AdminTablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantSlug: string;
  /** Pro restaurants give each table a waiter. */
  plan?: PlanTier;
  /** Printed on the table sticker above the QR code. */
  restaurantName?: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export default function AdminTablesModal({
  isOpen,
  onClose,
  restaurantSlug,
  plan = 'basic',
  restaurantName,
}: AdminTablesModalProps) {
  const isPro = hasPlan(plan, 'pro');
  const [waiters, setWaiters] = useState<StaffMember[]>([]);
  const [waiterError, setWaiterError] = useState<string | null>(null);
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
  // The QR code is drawn here in the browser, so it works offline and can be downloaded or printed
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [waiterSaved, setWaiterSaved] = useState(false);

  useEffect(() => {
    if (!qrUrl) {
      setQrImage(null);
      return;
    }
    let cancelled = false;
    setQrError(false);
    QRCode.toDataURL(qrUrl, { width: 600, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQrImage(url);
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

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
      if (isPro) {
        fetchStaff()
          .then((staff) => setWaiters(staff.filter((s) => s.role === 'waiter' && s.is_active)))
          .catch((err) => console.warn('Failed to load waiters:', err));
      }
    } else {
      setSelectedTable(null);
      setQrUrl(null);
      setWaiterSaved(false);
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
    setWaiterSaved(false);
    setQrUrl(null);
    try {
      const res = await generateAdminTableQR(table.table_number);
      // The backend returns the table number unescaped (e.g. "table=Table 1"). Rebuild the query so
      // spaces and symbols are percent-encoded: many Android scanners cut a link at the first space,
      // which drops the token and leaves the customer unable to order.
      const [path, query = ''] = res.qr_url.split('?');
      setQrUrl(`${window.location.origin}${path}?${new URLSearchParams(query).toString()}`);
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

  const handleAssignWaiter = async (waiterId: string) => {
    if (!selectedTable) return;
    setWaiterError(null);
    setWaiterSaved(false);
    try {
      const updated = await assignTableWaiter(selectedTable.id, waiterId || null);
      // Keep the name on the table button in step, also when the response leaves it out
      const named = { ...updated, assigned_waiter_name: updated.assigned_waiter_id ? updated.assigned_waiter_name || waiters.find((w) => w.id === updated.assigned_waiter_id)?.full_name : '' };
      setTables((prev) => prev.map((tb) => (tb.id === named.id ? { ...tb, ...named } : tb)));
      setSelectedTable((prev) => (prev && prev.id === named.id ? { ...prev, ...named } : prev));
      setWaiterSaved(true);
    } catch (err: unknown) {
      setWaiterError(err instanceof Error ? err.message : 'Failed to assign waiter');
    }
  };

  const qrFileName = (table: AdminTable) =>
    `${restaurantSlug || 'menu'}-${tableLabel(table.table_number).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-qr.png`;

  // Prints only the sticker (restaurant, table, QR), not the whole admin page
  const handlePrintSticker = () => {
    if (!qrImage || !selectedTable) return;
    const win = window.open('', '_blank', 'width=480,height=640');
    if (!win) return;
    const label = escapeHtml(tableLabel(selectedTable.table_number));
    const name = restaurantName ? `<div class="name">${escapeHtml(restaurantName)}</div>` : '';
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${label} QR</title><style>
      @page { margin: 12mm; }
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; display: flex; justify-content: center; margin: 0; }
      .sticker { width: 80mm; border: 1px dashed #94a3b8; border-radius: 6mm; padding: 6mm; text-align: center; }
      .name { font-size: 16pt; font-weight: 800; margin-bottom: 1mm; }
      .table { font-size: 13pt; font-weight: 700; color: #334155; }
      img { width: 64mm; height: 64mm; display: block; margin: 4mm auto; }
      .hint { font-size: 10pt; color: #475569; }
    </style></head><body><div class="sticker">${name}<div class="table">${label}</div>
      <img src="${qrImage}" alt="QR code"><div class="hint">${escapeHtml(text.tables.stickerHint)}</div></div>
      <script>window.onload = function () { window.focus(); window.print(); };</script></body></html>`);
    win.document.close();
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
                      {tableLabel(t.table_number)}
                      {isPro && (
                        <span style={{ fontWeight: 500, opacity: 0.75 }}>
                          {' · '}
                          {t.assigned_waiter_id ? t.assigned_waiter_name || '?' : text.tables.noWaiterShort}
                        </span>
                      )}
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
              {isPro && (
                <label className="admin-input-label" style={{ width: '100%', textAlign: 'left' }}>
                  {text.tables.waiter}
                  <select
                    className="admin-input-control"
                    value={selectedTable.assigned_waiter_id || ''}
                    onChange={(e) => handleAssignWaiter(e.target.value)}
                  >
                    <option value="">{text.tables.noWaiter}</option>
                    {selectedTable.assigned_waiter_id && !waiters.some((w) => w.id === selectedTable.assigned_waiter_id) && (
                      <option value={selectedTable.assigned_waiter_id} disabled>
                        {text.tables.turnedOff(selectedTable.assigned_waiter_name || '?')}
                      </option>
                    )}
                    {waiters.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.full_name}
                      </option>
                    ))}
                  </select>
                  {waiterSaved && !waiterError && (
                    <span role="status" style={{ color: 'var(--admin-success, #10b981)', fontSize: '12px', fontWeight: 700 }}>
                      <Check size={12} /> {text.tables.saved}
                    </span>
                  )}
                  {waiterError && (
                    <span role="alert" style={{ color: 'var(--admin-danger)', fontSize: '12px' }}>
                      {waiterError}
                    </span>
                  )}
                </label>
              )}

              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-text-main)' }}>
                QR Code for {tableLabel(selectedTable.table_number)}
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
                    {qrImage ? (
                      <img
                        src={qrImage}
                        alt={`${tableLabel(selectedTable.table_number)} QR`}
                        style={{ width: '180px', height: '180px', display: 'block' }}
                      />
                    ) : qrError ? (
                      <div role="alert" style={{ width: '180px', fontSize: '12px', color: 'var(--admin-danger)' }}>{text.tables.qrFailed}</div>
                    ) : (
                      <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 size={20} className="admin-spin" />
                      </div>
                    )}
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

                    {qrImage && (
                      <a
                        className="admin-sec-pill-btn"
                        href={qrImage}
                        download={qrFileName(selectedTable)}
                        style={{ height: '36px', fontSize: '12px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                      >
                        <Download size={14} />
                        {text.tables.downloadQr}
                      </a>
                    )}

                    <button
                      type="button"
                      className="admin-sec-pill-btn"
                      onClick={handlePrintSticker}
                      disabled={!qrImage}
                      style={{ height: '36px', fontSize: '12px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Printer size={14} />
                      {text.tables.printSticker}
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
