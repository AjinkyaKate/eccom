'use client';

import { useEffect, useState, useCallback } from 'react';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getErrorMessage } from '@/lib/api';

const EMPTY_FORM = { name: '', description: '', image: '', displayOrder: 0, isActive: true };

function CategoryModal({ category, onClose, onSaved }) {
  const isEdit = !!category;
  const [form, setForm] = useState(
    isEdit
      ? {
          name: category.name || '',
          description: category.description || '',
          image: category.image || '',
          displayOrder: category.displayOrder ?? 0,
          isActive: category.isActive ?? true,
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const token = window.localStorage.getItem('adminToken');
    try {
      if (isEdit) {
        await apiFetch(`/api/categories/${category._id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, displayOrder: Number(form.displayOrder) }),
        });
      } else {
        await apiFetch('/api/categories', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, displayOrder: Number(form.displayOrder) }),
        });
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="panel-surface w-full max-w-lg rounded-[2rem] border border-palette-light shadow-panel">
        <div className="flex items-center justify-between border-b border-palette-light px-8 py-5">
          <h2 className="text-2xl font-semibold text-palette-dark">
            {isEdit ? 'Edit category' : 'New category'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-palette-dark/50 hover:bg-palette-lighter hover:text-palette-dark">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-8 py-6">
          <div>
            <label className="mb-1 block text-sm font-semibold text-palette-dark">Name *</label>
            <input required value={form.name} onChange={set('name')} className="input-field" placeholder="e.g. Electronics" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-palette-dark">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2} className="input-field" placeholder="Optional description" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-palette-dark">Image URL</label>
            <input value={form.image} onChange={set('image')} className="input-field" placeholder="https://..." />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-palette-dark">Display order</label>
            <input type="number" value={form.displayOrder} onChange={set('displayOrder')} className="input-field" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-palette-dark">
            <input type="checkbox" checked={form.isActive} onChange={set('isActive')} className="h-4 w-4 accent-palette-primary" />
            Active
          </label>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="rounded-full bg-palette-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-palette-dark disabled:opacity-60">
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create category'}
            </button>
            <button type="button" onClick={onClose} className="rounded-full border border-palette-light px-6 py-2.5 text-sm font-semibold text-palette-dark hover:bg-palette-lighter">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | { category? }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('adminToken');
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(res?.data?.categories || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = window.localStorage.getItem('adminToken');
    try {
      await apiFetch(`/api/admin/categories/${deleteTarget._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-shell space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeading eyebrow="Catalogue" title="Categories" />
        <button
          type="button"
          onClick={() => setModal({})}
          className="rounded-full bg-palette-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-palette-dark"
        >
          + New category
        </button>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="panel-surface rounded-[2rem] border border-palette-light/80 shadow-panel">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-palette-light text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-palette-primary/70">
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Slug</th>
                <th className="px-6 py-4">Order</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-palette-light/70 text-palette-dark">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-palette-dark/50">Loading...</td></tr>
              ) : categories.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-palette-dark/50">No categories yet.</td></tr>
              ) : categories.map((cat) => (
                <tr key={cat._id} className="hover:bg-palette-mist">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="h-9 w-9 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-palette-lighter text-xs font-semibold text-palette-primary">
                          {cat.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold">{cat.name}</p>
                        {cat.description && (
                          <p className="max-w-xs truncate text-xs text-palette-dark/50">{cat.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-palette-dark/60">{cat.slug}</td>
                  <td className="px-6 py-4 text-palette-dark/70">{cat.displayOrder}</td>
                  <td className="px-6 py-4">
                    <StatusPill tone={cat.isActive ? 'success' : 'soft'}>
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </StatusPill>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setModal({ category: cat })}
                        className="rounded-full border border-palette-light px-3 py-1 text-xs font-semibold text-palette-dark transition hover:border-palette-primary hover:text-palette-primary"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(cat)}
                        className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && (
        <CategoryModal
          category={modal.category || null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="panel-surface w-full max-w-sm rounded-[2rem] border border-palette-light p-8 shadow-panel">
            <h2 className="text-xl font-semibold text-palette-dark">Delete category?</h2>
            <p className="mt-2 text-sm text-palette-dark/70">
              <strong>{deleteTarget.name}</strong> will be permanently deleted. Products in this category will become uncategorised.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-full border border-palette-light px-5 py-2.5 text-sm font-semibold text-palette-dark hover:bg-palette-lighter">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
