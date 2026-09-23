import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { X, Check, Image as ImageIcon, UploadCloud, Link as LinkIcon, Trash2, Sparkles, Loader2 } from 'lucide-react';
import type { MenuItem, Category } from '../types';
import { uploadImageToCloudinary } from '../services/uploadService';

interface AdminItemModalProps {
  isOpen: boolean;
  item: MenuItem | null;
  categories: Category[];
  currency: string;
  defaultCategoryId?: string;
  onClose: () => void;
  onSave: (item: MenuItem) => void;
}

const ALL_TAGS: ('vegetarian' | 'spicy' | 'gluten-free' | 'vegan' | 'chef-pick')[] = [
  'chef-pick',
  'spicy',
  'vegetarian',
  'vegan',
  'gluten-free',
];

const PRESET_FOOD_IMAGES = [
  { label: 'Burger', url: '/images/burger_classic.jpg' },
  { label: 'Pizza', url: '/images/pizza_slice.jpg' },
  { label: 'Pasta Ragu', url: '/images/spaghetti_beef_ragu.webp' },
  { label: 'Pesto Pasta', url: '/images/basil_pesto_pasta.webp' },
  { label: 'Steak', url: '/images/ribeye_steak.webp' },
  { label: 'Burrata Salad', url: '/images/burrata_heirloom.webp' },
  { label: 'Tiramisu', url: '/images/classic_tiramisu.webp' },
  { label: 'Panna Cotta', url: '/images/pistachio_panna_cotta.webp' },
  { label: 'Mojito Drink', url: '/images/classic_mojito.webp' },
  { label: 'Artisan Coffee', url: '/images/artisanal_coffee.webp' },
  { label: 'Fresh Juice', url: '/images/fresh_juice.webp' },
  { label: 'Truffle Fries', url: '/images/truffle_fries.webp' },
];

export default function AdminItemModal({
  isOpen,
  item,
  categories,
  currency,
  defaultCategoryId,
  onClose,
  onSave,
}: AdminItemModalProps) {
  const [formData, setFormData] = useState<Partial<MenuItem> & { priceInput?: string | number }>({
    name: '',
    subtitle: '',
    categoryId: categories[0]?.id || 'food',
    priceInput: '',
    description: '',
    fullDescription: '',
    imageUrl: '',
    tags: [],
    available: true,
  });

  const [imageInputMode, setImageInputMode] = useState<'upload' | 'preset' | 'url'>('upload');
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track previous open state and itemId to only re-initialize when modal actually opens or item changes,
  // preventing window tab/focus events from resetting what the user typed.
  const prevOpenRef = useRef(false);
  const prevItemIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const isOpening = isOpen && !prevOpenRef.current;
    const isItemChanged = item?.id !== prevItemIdRef.current;

    if (isOpen && (isOpening || isItemChanged)) {
      if (item) {
        setFormData({
          ...item,
          priceInput: item.price !== undefined ? item.price : '',
        });
        setImageInputMode(item.imageUrl?.startsWith('data:') ? 'upload' : item.imageUrl ? 'preset' : 'upload');
      } else {
        const initialCatId =
          defaultCategoryId && defaultCategoryId !== 'all' && categories.some((c) => c.id === defaultCategoryId)
            ? defaultCategoryId
            : categories[0]?.id || 'food';

        setFormData({
          id: `dish-${Date.now()}`,
          name: '',
          subtitle: '',
          categoryId: initialCatId,
          priceInput: '', // Start empty so 0 is not in the way when typing
          description: '',
          fullDescription: '',
          imageUrl: '',
          tags: [],
          available: true,
        });
        setImageInputMode('upload');
      }
      setImageUploadError(null);
    }

    prevOpenRef.current = isOpen;
    prevItemIdRef.current = item?.id;
  }, [isOpen, item, defaultCategoryId, categories]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    setImageUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageUploadError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    // Check size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setImageUploadError('Image size is too large (max 5MB).');
      return;
    }

    setIsUploading(true);
    try {
      const secureUrl = await uploadImageToCloudinary(file, 'dishes');
      setFormData((prev) => ({ ...prev, imageUrl: secureUrl }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload image. Please try again.';
      setImageUploadError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    const rawPrice = formData.priceInput !== undefined ? formData.priceInput : formData.price;
    const numericPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice)) || 0;

    const finalizedItem: MenuItem = {
      id: formData.id || `dish-${Date.now()}`,
      name: formData.name.trim(),
      subtitle: formData.subtitle?.trim() || undefined,
      categoryId: formData.categoryId || categories[0]?.id || 'food',
      price: numericPrice,
      description: formData.description?.trim() || '',
      fullDescription: formData.fullDescription?.trim() || undefined,
      imageUrl: formData.imageUrl?.trim() || '/images/default_food.png',
      tags: formData.tags || [],
      available: formData.available !== false,
    };

    onSave(finalizedItem);
    onClose();
  };

  const toggleTag = (tag: 'vegetarian' | 'spicy' | 'gluten-free' | 'vegan' | 'chef-pick') => {
    const current = formData.tags || [];
    if (current.includes(tag)) {
      setFormData({ ...formData, tags: current.filter((t) => t !== tag) });
    } else {
      setFormData({ ...formData, tags: [...current, tag] });
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-dialog"
        style={{ maxWidth: '620px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="admin-modal-header">
          <h3 className="admin-modal-title">
            {item ? `Edit "${item.name}"` : 'Add New Dish'}
          </h3>
          <button
            type="button"
            className="admin-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            {/* Dish Name */}
            <div>
              <label className="admin-input-label">Dish Name *</label>
              <input
                type="text"
                required
                className="admin-input-control"
                placeholder="e.g. Classic Beef Burger"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Category and Price Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="admin-input-label">Category *</label>
                <select
                  className="admin-input-control"
                  value={formData.categoryId || categories[0]?.id || ''}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                >
                  {categories
                    .filter((cat) => cat.id.toLowerCase() !== 'all' && cat.name.toLowerCase() !== 'all')
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="admin-input-label">Price ({currency}) *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  className="admin-input-control"
                  placeholder="0.00"
                  value={formData.priceInput !== undefined ? formData.priceInput : ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priceInput: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            {/* Food Picture Section */}
            <div className="admin-image-upload-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label className="admin-input-label" style={{ margin: 0 }}>
                  Dish Picture
                </label>
                <div className="admin-img-mode-pills">
                  <button
                    type="button"
                    className={`admin-img-mode-btn ${imageInputMode === 'upload' ? 'active' : ''}`}
                    onClick={() => setImageInputMode('upload')}
                  >
                    <UploadCloud size={13} />
                    Upload
                  </button>
                  <button
                    type="button"
                    className={`admin-img-mode-btn ${imageInputMode === 'preset' ? 'active' : ''}`}
                    onClick={() => setImageInputMode('preset')}
                  >
                    <Sparkles size={13} />
                    Presets
                  </button>
                  <button
                    type="button"
                    className={`admin-img-mode-btn ${imageInputMode === 'url' ? 'active' : ''}`}
                    onClick={() => setImageInputMode('url')}
                  >
                    <LinkIcon size={13} />
                    Web Link
                  </button>
                </div>
              </div>

              {/* Picture Preview & Actions Box */}
              {formData.imageUrl ? (
                <div className="admin-image-preview-card">
                  <div className="admin-image-preview-thumb">
                    <img
                      src={formData.imageUrl}
                      alt="Dish preview"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/default_food.png';
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--admin-text-main)', marginBottom: '4px' }}>
                      Selected Image
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                      {formData.imageUrl.startsWith('data:') ? 'Uploaded image from device' : formData.imageUrl}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="admin-sec-pill-btn"
                      style={{ height: '34px', fontSize: '12px', padding: '0 12px' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      className="admin-sec-pill-btn"
                      style={{ height: '34px', fontSize: '12px', padding: '0 12px', color: 'var(--admin-danger)', borderColor: '#fca5a5' }}
                      onClick={() => setFormData({ ...formData, imageUrl: '' })}
                      title="Remove image"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />

              {/* Mode 1: Direct Device Upload Dropzone */}
              {imageInputMode === 'upload' && (
                <div
                  className="admin-image-dropzone"
                  style={{
                    opacity: isUploading ? 0.75 : 1,
                    pointerEvents: isUploading ? 'none' : 'auto',
                    cursor: isUploading ? 'wait' : 'pointer',
                  }}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (isUploading) return;
                    if (e.dataTransfer.files?.[0]) {
                      const file = e.dataTransfer.files[0];
                      const fakeEvent = { target: { files: [file] } } as unknown as ChangeEvent<HTMLInputElement>;
                      handleFileUpload(fakeEvent);
                    }
                  }}
                >
                  <div className="admin-dropzone-icon">
                    {isUploading ? (
                      <Loader2 size={28} className="admin-spin" />
                    ) : (
                      <UploadCloud size={28} />
                    )}
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--admin-text-main)' }}>
                    {isUploading ? 'Uploading securely to Cloudinary...' : 'Click to upload food photo from device'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                    {isUploading
                      ? 'Generating cryptographic signature & optimizing dynamic CDN delivery'
                      : 'Supports PNG, JPG, WEBP (up to 5MB) or Drag & Drop here'}
                  </div>
                </div>
              )}

              {/* Mode 2: Quick Presets Grid */}
              {imageInputMode === 'preset' && (
                <div className="admin-presets-grid">
                  {PRESET_FOOD_IMAGES.map((preset) => {
                    const isSelected = formData.imageUrl === preset.url;
                    return (
                      <button
                        key={preset.url}
                        type="button"
                        className={`admin-preset-tile ${isSelected ? 'selected' : ''}`}
                        onClick={() => setFormData({ ...formData, imageUrl: preset.url })}
                      >
                        <img src={preset.url} alt={preset.label} />
                        <span>{preset.label}</span>
                        {isSelected && (
                          <div className="admin-preset-check">
                            <Check size={12} color="#ffffff" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Mode 3: Web URL input */}
              {imageInputMode === 'url' && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
                  <input
                    type="text"
                    className="admin-input-control"
                    placeholder="https://images.unsplash.com/... or /images/cat_food.jpg"
                    value={formData.imageUrl || ''}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  />
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1px solid var(--admin-border)',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {formData.imageUrl ? (
                      <img
                        src={formData.imageUrl}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/images/default_food.png';
                        }}
                      />
                    ) : (
                      <ImageIcon size={18} color="var(--admin-text-subtle)" />
                    )}
                  </div>
                </div>
              )}

              {imageUploadError && (
                <div style={{ color: '#ef4444', fontSize: '12.5px', marginTop: '6px' }}>
                  {imageUploadError}
                </div>
              )}
            </div>

            {/* Short Description */}
            <div>
              <label className="admin-input-label">Description</label>
              <textarea
                className="admin-textarea-control"
                placeholder="Brief description of the dish and ingredients..."
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Dietary / Feature Tags */}
            <div>
              <label className="admin-input-label">Tags & Badges</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {ALL_TAGS.map((tag) => {
                  const active = formData.tags?.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: active ? '1px solid var(--admin-primary)' : '1px solid var(--admin-border)',
                        background: active ? 'var(--admin-primary-light)' : '#ffffff',
                        color: active ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {active && <Check size={12} />}
                      {tag.replace('-', ' ').toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stock Availability */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--admin-text-main)',
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.available !== false}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--admin-primary)' }}
                />
                In Stock / Currently Available to Order
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="admin-modal-footer">
            <button type="button" className="admin-sec-pill-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="admin-save-pill-btn"
              disabled={isUploading}
              style={{
                backgroundColor: 'var(--admin-primary)',
                opacity: isUploading ? 0.7 : 1,
                cursor: isUploading ? 'not-allowed' : 'pointer',
              }}
            >
              {isUploading ? 'Uploading...' : item ? 'Save Changes' : 'Add Dish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

