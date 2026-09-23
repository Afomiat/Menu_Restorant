import { useState, useEffect, useRef } from 'react';
import { X, Settings, RefreshCw, DollarSign, Store, MapPin, Palette, Image as ImageIcon, UploadCloud, Loader2, Trash2 } from 'lucide-react';
import type { RestaurantMeta } from '../types';
import AdminConfirmModal from './AdminConfirmModal';
import { uploadImageToCloudinary } from '../services/uploadService';

interface AdminSettingsModalProps {
  isOpen: boolean;
  meta: RestaurantMeta | null;
  onClose: () => void;
  onSave: (updatedMeta: RestaurantMeta) => void;
  onResetToDefault: () => void;
}

const COMMON_CURRENCIES = [
  { code: 'ETB', label: 'ETB — Ethiopian Birr' },
  { code: 'SAR', label: 'SAR — Saudi Riyal' },
  { code: 'USD', label: 'USD ($) — US Dollar' },
  { code: 'EUR', label: 'EUR (€) — Euro' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'GBP', label: 'GBP (£) — British Pound' },
  { code: 'CAD', label: 'CAD ($) — Canadian Dollar' },
];

export default function AdminSettingsModal({
  isOpen,
  meta,
  onClose,
  onSave,
  onResetToDefault,
}: AdminSettingsModalProps) {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [currency, setCurrency] = useState('ETB');
  const [customCurrency, setCustomCurrency] = useState('');
  const [isCustomCurrency, setIsCustomCurrency] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#FF5A36');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [heroUploadError, setHeroUploadError] = useState<string | null>(null);
  const heroFileInputRef = useRef<HTMLInputElement>(null);

  const prevOpenRef = useRef(false);

  useEffect(() => {
    const isOpening = isOpen && !prevOpenRef.current;
    if (isOpen && meta && isOpening) {
      setName(meta.name || '');
      setTagline(meta.tagline || '');
      const cur = meta.currency || 'ETB';
      const isKnown = COMMON_CURRENCIES.some((c) => c.code === cur);
      if (isKnown) {
        setCurrency(cur);
        setIsCustomCurrency(false);
        setCustomCurrency('');
      } else {
        setCurrency('CUSTOM');
        setIsCustomCurrency(true);
        setCustomCurrency(cur);
      }
      setDeliveryAddress(meta.deliveryAddress || '');
      setHeroImageUrl(meta.heroImageUrl || '');
      setPrimaryColor(meta.colors?.primary || meta.theme?.primary || '#FF5A36');
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, meta]);

  if (!isOpen || !meta) return null;

  const handleHeroFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setHeroUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setHeroUploadError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setHeroUploadError('Image size is too large (max 5MB).');
      return;
    }

    setIsUploadingHero(true);
    try {
      const secureUrl = await uploadImageToCloudinary(file, 'branding');
      setHeroImageUrl(secureUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload hero image.';
      setHeroUploadError(msg);
    } finally {
      setIsUploadingHero(false);
      if (heroFileInputRef.current) {
        heroFileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCurrency = isCustomCurrency
      ? customCurrency.trim().toUpperCase() || 'ETB'
      : currency;

    const updatedMeta: RestaurantMeta = {
      ...meta,
      name: name.trim() || meta.name,
      tagline: tagline.trim(),
      currency: finalCurrency,
      deliveryAddress: deliveryAddress.trim() || undefined,
      heroImageUrl: heroImageUrl.trim() || undefined,
      colors: {
        ...meta.colors,
        primary: primaryColor,
      },
      theme: {
        ...meta.theme,
        primary: primaryColor,
      },
    };

    onSave(updatedMeta);
    onClose();
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-dialog"
        style={{ maxWidth: '520px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="admin-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={20} color="var(--admin-primary)" />
            <h3 className="admin-modal-title">Restaurant & Currency Settings</h3>
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

        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Restaurant Name */}
            <div>
              <label className="admin-input-label">
                <Store size={14} style={{ display: 'inline', marginRight: '5px' }} />
                Restaurant Name *
              </label>
              <input
                type="text"
                required
                className="admin-input-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Breath, Aura, Luna"
              />
            </div>

            {/* Tagline */}
            <div>
              <label className="admin-input-label">Tagline / Cuisine Subtitle</label>
              <input
                type="text"
                className="admin-input-control"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Modern Dining & Lounge"
              />
            </div>

            {/* Currency Setting */}
            <div>
              <label className="admin-input-label">
                <DollarSign size={14} style={{ display: 'inline', marginRight: '5px' }} />
                Menu Currency *
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  className="admin-input-control"
                  style={{ flex: 1 }}
                  value={isCustomCurrency ? 'CUSTOM' : currency}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'CUSTOM') {
                      setIsCustomCurrency(true);
                    } else {
                      setIsCustomCurrency(false);
                      setCurrency(val);
                    }
                  }}
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                  <option value="CUSTOM">Custom currency code...</option>
                </select>

                {isCustomCurrency && (
                  <input
                    type="text"
                    required
                    maxLength={6}
                    className="admin-input-control"
                    style={{ width: '110px' }}
                    value={customCurrency}
                    onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
                    placeholder="e.g. KES"
                  />
                )}
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', margin: '5px 0 0 2px' }}>
                Selected currency will apply everywhere across dishes, cart drawer, and live customer menus.
              </p>
            </div>

            {/* Delivery Address / Location */}
            <div>
              <label className="admin-input-label">
                <MapPin size={14} style={{ display: 'inline', marginRight: '5px' }} />
                Delivery Address / Location
              </label>
              <input
                type="text"
                className="admin-input-control"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="e.g. 11/2 Diriyah, Riyadh"
              />
            </div>

            {/* Hero Banner Showcase Image (Diagonal Card) */}
            <div>
              <label className="admin-input-label">
                <ImageIcon size={14} style={{ display: 'inline', marginRight: '5px' }} />
                Hero Banner Showcase Image (Diagonal Cut)
              </label>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="admin-input-control"
                  style={{ flex: 1 }}
                  value={heroImageUrl}
                  onChange={(e) => setHeroImageUrl(e.target.value)}
                  placeholder="e.g. /images/burger_classic.jpg or image URL"
                />
                <input
                  ref={heroFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleHeroFileUpload}
                />
                <button
                  type="button"
                  className="admin-sec-pill-btn"
                  disabled={isUploadingHero}
                  onClick={() => heroFileInputRef.current?.click()}
                  style={{ height: '38px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isUploadingHero ? (
                    <>
                      <Loader2 size={14} className="admin-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} />
                      Upload
                    </>
                  )}
                </button>
              </div>

              {heroImageUrl && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                  <img
                    src={heroImageUrl}
                    alt="Hero banner preview"
                    style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {heroImageUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHeroImageUrl('')}
                    style={{ background: 'none', border: 'none', color: 'var(--admin-danger)', cursor: 'pointer', padding: '4px' }}
                    title="Remove image"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

              {heroUploadError && (
                <p style={{ fontSize: '11.5px', color: 'var(--admin-danger)', margin: '4px 0 0 2px' }}>
                  {heroUploadError}
                </p>
              )}

              <p style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', margin: '5px 0 0 2px' }}>
                Displayed with a diagonal cut and blurred atmospheric backdrop on the customer menu hero banner.
              </p>
            </div>

            {/* Primary Brand Color */}
            <div>
              <label className="admin-input-label">
                <Palette size={14} style={{ display: 'inline', marginRight: '5px' }} />
                Brand Primary Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{
                    width: '42px',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                />
                <input
                  type="text"
                  className="admin-input-control"
                  style={{ flex: 1, fontFamily: 'monospace' }}
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
            </div>

            {/* Reset Data Section */}
            <div
              style={{
                marginTop: '10px',
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#9f1239' }}>
                  Reset Menu to JSON File
                </div>
                <div style={{ fontSize: '11.5px', color: '#be123c', marginTop: '2px' }}>
                  Discards local changes and reloads original data from disk.
                </div>
              </div>
              <button
                type="button"
                className="admin-sec-pill-btn"
                style={{ borderColor: '#f43f5e', color: '#e11d48', backgroundColor: '#ffffff' }}
                onClick={() => setIsResetConfirmOpen(true)}
              >
                <RefreshCw size={14} />
                <span>Reset</span>
              </button>
            </div>
          </div>

          <div className="admin-modal-footer">
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-modal-btn admin-modal-btn-save"
              disabled={isUploadingHero}
              style={{
                opacity: isUploadingHero ? 0.7 : 1,
                cursor: isUploadingHero ? 'not-allowed' : 'pointer',
              }}
            >
              {isUploadingHero ? 'Uploading...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Factory Reset Confirmation Modal */}
      <AdminConfirmModal
        isOpen={isResetConfirmOpen}
        title="Reset Menu to Factory Defaults"
        message="Are you sure you want to reset this restaurant menu to factory defaults? All unsaved browser edits will be discarded and replaced with the original JSON file."
        confirmLabel="Reset to Defaults"
        isDestructive={true}
        onConfirm={() => {
          onResetToDefault();
          onClose();
        }}
        onClose={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
}
