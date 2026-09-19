import { useState } from 'react';
import { X, Plus, Trash2, FolderTree, AlertCircle } from 'lucide-react';
import type { Category, MenuItem } from '../types';
import AdminConfirmModal from './AdminConfirmModal';

interface AdminCategoryModalProps {
  isOpen: boolean;
  categories: Category[];
  items: MenuItem[];
  onClose: () => void;
  onUpdateCategories: (newCats: Category[]) => void;
}

export default function AdminCategoryModal({
  isOpen,
  categories,
  items,
  onClose,
  onUpdateCategories,
}: AdminCategoryModalProps) {
  const [newCatName, setNewCatName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Category deletion confirmation state
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  if (!isOpen) return null;

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase() === 'all' || trimmed.toLowerCase() === 'all dishes') {
      setErrorMessage('The category name "All" is reserved for the system overview.');
      return;
    }

    // Generate unique slug ID from full category name
    const baseSlug =
      trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `cat-${Date.now()}`;

    let id = baseSlug;
    let counter = 1;
    while (categories.some((c) => c.id === id)) {
      id = `${baseSlug}-${counter}`;
      counter++;
    }

    const newCategory: Category = {
      id,
      name: trimmed,
      sortOrder: categories.length + 1,
      iconUrl: '/images/cat_food.jpg',
    };

    onUpdateCategories([...categories, newCategory]);
    setNewCatName('');
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    onUpdateCategories(categories.filter((c) => c.id !== categoryToDelete.id));
    setCategoryToDelete(null);
  };

  const itemsInDeletingCat = categoryToDelete
    ? items.filter((it) => it.categoryId === categoryToDelete.id).length
    : 0;

  return (
    <>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div
          className="admin-modal-dialog"
          style={{ maxWidth: '520px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="admin-modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderTree size={20} color="var(--admin-primary)" />
              <h3 className="admin-modal-title">Manage Categories</h3>
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

          <div className="admin-modal-body">
            {/* Add Category Form */}
            <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="admin-input-label">New Category Name *</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    required
                    className="admin-input-control"
                    placeholder="e.g. Desserts, Burgers, Drinks"
                    value={newCatName}
                    onChange={(e) => {
                      setNewCatName(e.target.value);
                      setErrorMessage(null);
                    }}
                  />
                  <button
                    type="submit"
                    className="admin-save-pill-btn"
                    style={{ whiteSpace: 'nowrap', backgroundColor: 'var(--admin-primary)' }}
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
                {errorMessage && (
                  <div style={{ color: '#ef4444', fontSize: '12.5px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} />
                    {errorMessage}
                  </div>
                )}
              </div>
            </form>

            {/* Existing Categories List */}
            <div>
              <label className="admin-input-label" style={{ marginTop: '8px' }}>
                Current Categories ({categories.length})
              </label>
              <div className="admin-cat-list">
                {categories
                  .filter((cat) => cat.id.toLowerCase() !== 'all' && cat.name.toLowerCase() !== 'all')
                  .map((cat) => {
                  const count = items.filter((it) => it.categoryId === cat.id).length;
                  return (
                    <div key={cat.id} className="admin-cat-list-item">
                      <div>
                        <div className="admin-cat-list-title">{cat.name}</div>
                        <div className="admin-cat-list-sub">
                          ID: <code>{cat.id}</code> • {count} {count === 1 ? 'dish' : 'dishes'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="admin-dish-dots-btn"
                        onClick={() => setCategoryToDelete(cat)}
                        title="Delete category"
                        style={{ color: 'var(--admin-danger)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="admin-modal-footer">
            <button type="button" className="admin-sec-pill-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>

      {/* In-App Confirmation Modal for Category Deletion */}
      <AdminConfirmModal
        isOpen={Boolean(categoryToDelete)}
        title="Delete Category"
        message={
          itemsInDeletingCat > 0
            ? `This category contains ${itemsInDeletingCat} dishes. Deleting it will leave those dishes uncategorized. Are you sure?`
            : `Are you sure you want to delete the category "${categoryToDelete?.name}"?`
        }
        itemName={categoryToDelete?.name}
        confirmLabel="Delete Category"
        onConfirm={confirmDeleteCategory}
        onClose={() => setCategoryToDelete(null)}
      />
    </>
  );
}
