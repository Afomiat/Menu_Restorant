import { useState, useEffect, useRef } from 'react';
import { X, FolderTree, Save, AlertCircle } from 'lucide-react';
import type { Category } from '../types';

interface AdminEditCategoryModalProps {
  isOpen: boolean;
  category: Category | null;
  onClose: () => void;
  onSave: (categoryId: string, newName: string) => void;
}

export default function AdminEditCategoryModal({
  isOpen,
  category,
  onClose,
  onSave,
}: AdminEditCategoryModalProps) {
  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const prevOpenRef = useRef(false);
  const prevCatIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const isOpening = isOpen && !prevOpenRef.current;
    const isCatChanged = category?.id !== prevCatIdRef.current;

    if (isOpen && category && (isOpening || isCatChanged)) {
      setName(category.name);
      setErrorMessage(null);
    }
    prevOpenRef.current = isOpen;
    prevCatIdRef.current = category?.id;
  }, [category, isOpen]);

  if (!isOpen || !category) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === 'all' || trimmed.toLowerCase() === 'all dishes') {
      setErrorMessage('The category name "All" is reserved for the system overview.');
      return;
    }
    onSave(category.id, trimmed);
    onClose();
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-dialog"
        style={{ maxWidth: '440px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="admin-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderTree size={20} color="var(--admin-primary)" />
            <h3 className="admin-modal-title">Rename Category</h3>
          </div>
          <button
            type="button"
            className="admin-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            <div>
              <label className="admin-input-label">Category Name *</label>
              <input
                type="text"
                required
                autoFocus
                className="admin-input-control"
                placeholder="e.g. Gourmet Burgers"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrorMessage(null);
                }}
              />
              {errorMessage && (
                <div style={{ color: '#ef4444', fontSize: '12.5px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={14} />
                  {errorMessage}
                </div>
              )}
            </div>
          </div>

          <div className="admin-modal-footer">
            <button type="button" className="admin-sec-pill-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="admin-save-pill-btn"
              style={{ backgroundColor: 'var(--admin-primary)' }}
            >
              <Save size={15} />
              Save Name
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
