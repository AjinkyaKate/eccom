'use client';

import { useEffect, useState, useCallback } from 'react';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

const EMPTY_FORM = {
  name: '',
  category: '',
  price: '',
  discountPrice: '',
  stock: '',
  sku: '',
  shortDescription: '',
  mainImage: '',
  tags: '',
  isFeatured: false,
  isActive: true,
};

function ProductModal({ product, categories, onClose, onSaved }) {
  const isEdit = !!product;
  const [form, setForm] = useState(
    isEdit
      ? {
          name: product.name || '',
          category: product.category?._id || product.category || '',
          price: product.price ?? '',
          discountPrice: product.discountPrice ?? '',
          stock: product.stock ?? '',
          sku: product.sku || '',
          shortDescription: product.shortDescription || '',
          mainImage: product.mainImage || '',
          tags: Array.isArray(product.tags) ? product.tags.join(', ') : '',
          isFeatured: product.isFeatured ?? false,
          isActive: product.isActive ?? true,
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
    const body = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      discountPrice: form.discountPrice === '' ? null : Number(form.discountPrice),
      stock: Number(form.stock),
      sku: form.sku,
      shortDescription: form.shortDescription,
      mainImage: form.mainImage,
      tags: form.tags,
      isFeatured: form.isFeatured,
      isActive: form.isActive,
    };

    try {
      if (isEdit) {
        await apiFetch(`/api/admin/products/${product._id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
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
      <div className="panel-surface w-full max-w-2xl rounded-[2rem] border border-palette-light shadow-panel">
        <div className="flex items-center justify-between border-b border-palette-light px-8 py-5">
          <h2 className="text-2xl font-semibold text-palette-dark">
            {isEdit ? 'Edit product' : 'New product'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-palette-dark/50 hover:bg-palette-lighter hover:text-palette-dark">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-8 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-palette-dark">Product name *</label>
              <input required value={form.name} onChange={set('name')} className="input-field" placeholder="e.g. Wireless Headphones" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-palette-dark">Category *</label>
              <select required value={form.category} onChange={set('category')} className="input-field">
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-palette-dark">SKU *</label>
              <input required value={form.sku} onChange={set('sku')} className="input-field" placeholder="e.g. WH-001" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-palette-dark">Price (₹) *</label>
              <input required type="number" min="0" step="0.01" value={form.price} onChange={set('price')} className="input-field" placeholder="0.00" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-palette-dark">Discount price (₹)</label>
              <input type="number" min="0" step="0.01" value={form.discountPrice} onChange={set('discountPrice')} className="input-field" placeholder="Leave blank for no discount" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-palette-dark">Stock *</label>
              <input required type="number" min="0" value={form.stock} onChange={set('stock')} className="input-field" placeholder="0" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-palette-dark">Main image URL</label>
              <input value={form.mainImage} onChange={set('mainImage')} className="input-field" placeholder="https://..." />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-palette-dark">Short description</label>
              <textarea value={form.shortDescription} onChange={set('shortDescription')} rows={2} className="input-field" placeholder="Brief product summary" />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-palette-dark">Tags (comma-separated)</label>
              <input value={form.tags} onChange={set('tags')} className="input-field" placeholder="e.g. wireless, audio, premium" />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-palette-dark">
                <input type="checkbox" checked={form.isActive} onChange={set('isActive')} className="h-4 w-4 accent-palette-primary" />
                Active
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-palette-dark">
                <input type="checkbox" checked={form.isFeatured} onChange={set('isFeatured')} className="h-4 w-4 accent-palette-primary" />
                Featured
              </label>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={saving} className="rounded-full bg-palette-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-palette-dark disabled:opacity-60">
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create product'}
            </button>
            <button type="button" onClick={onClose} className="rounded-full border border-palette-light px-6 py-2.5 text-sm font-semibold text-palette-dark transition hover:bg-palette-lighter">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StockModal({ product, onClose, onSaved }) {
  const [qty, setQty] = useState('');
  const [op, setOp] = useState('add');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const token = window.localStorage.getItem('adminToken');
    try {
      await apiFetch(`/api/admin/products/${product._id}/stock`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: Number(qty), operation: op }),
      });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="panel-surface w-full max-w-sm rounded-[2rem] border border-palette-light p-8 shadow-panel">
        <h2 className="text-xl font-semibold text-palette-dark">Update stock</h2>
        <p className="mt-1 text-sm text-palette-dark/70">{product.name} — current: {product.stock}</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <select value={op} onChange={(e) => setOp(e.target.value)} className="input-field">
            <option value="add">Add</option>
            <option value="subtract">Subtract</option>
            <option value="set">Set to</option>
          </select>
          <input required type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="input-field" placeholder="Quantity" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-full bg-palette-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'Saving...' : 'Update'}
            </button>
            <button type="button" onClick={onClose} className="rounded-full border border-palette-light px-5 py-2.5 text-sm font-semibold text-palette-dark hover:bg-palette-lighter">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | { type: 'product', product? } | { type: 'stock', product }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('adminToken');
    if (!token) return;

    setIsLoading(true);
    setError('');

    const params = new URLSearchParams({ page, limit: 15 });
    if (search) params.set('search', search);
    if (filterActive !== '') params.set('isActive', filterActive);

    try {
      const [productsRes, categoriesRes] = await Promise.all([
        apiFetch(`/api/admin/products?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setProducts(productsRes?.data?.products || []);
      setPagination(productsRes?.data?.pagination || null);
      setCategories(categoriesRes?.data?.categories || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, search, filterActive]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = window.localStorage.getItem('adminToken');
    try {
      await apiFetch(`/api/admin/products/${deleteTarget._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-shell space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeading eyebrow="Catalogue" title="Products" />
        <button
          type="button"
          onClick={() => setModal({ type: 'product' })}
          className="rounded-full bg-palette-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-palette-dark"
        >
          + New product
        </button>
      </div>

      {/* Filters */}
      <div className="panel-surface flex flex-wrap items-end gap-4 rounded-[2rem] border border-palette-light/80 px-6 py-5 shadow-panel">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, tag..."
            className="input-field min-w-0 flex-1"
          />
          <button type="submit" className="rounded-full bg-palette-primary px-4 py-2 text-sm font-semibold text-white hover:bg-palette-dark">
            Search
          </button>
        </form>
        <select
          value={filterActive}
          onChange={(e) => { setFilterActive(e.target.value); setPage(1); }}
          className="input-field w-40"
        >
          <option value="">All status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="panel-surface rounded-[2rem] border border-palette-light/80 shadow-panel">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-palette-light text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-palette-primary/70">
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-palette-light/70 text-palette-dark">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-palette-dark/50">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-palette-dark/50">No products found.</td></tr>
              ) : products.map((p) => (
                <tr key={p._id} className="hover:bg-palette-mist">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {p.mainImage ? (
                        <img src={p.mainImage} alt={p.name} className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-palette-lighter text-xs text-palette-primary/50">img</div>
                      )}
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs text-palette-dark/50">SKU: {p.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-palette-dark/70">{p.category?.name || '—'}</td>
                  <td className="px-6 py-4">
                    <p className="font-semibold">{formatCurrency(p.finalPrice ?? p.price)}</p>
                    {p.discountPrice ? (
                      <p className="text-xs text-palette-dark/50 line-through">{formatCurrency(p.price)}</p>
                    ) : null}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => setModal({ type: 'stock', product: p })}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition hover:border-palette-primary hover:text-palette-primary ${
                        p.stock === 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-palette-light bg-palette-lighter text-palette-dark'
                      }`}
                    >
                      {p.stock} units
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill tone={p.isActive ? 'success' : 'soft'}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </StatusPill>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setModal({ type: 'product', product: p })}
                        className="rounded-full border border-palette-light px-3 py-1 text-xs font-semibold text-palette-dark transition hover:border-palette-primary hover:text-palette-primary"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(p)}
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

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-palette-light px-6 py-4">
            <p className="text-sm text-palette-dark/60">
              {pagination.totalItems} products · page {pagination.currentPage} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full border border-palette-light px-4 py-2 text-sm font-semibold text-palette-dark disabled:opacity-40 hover:enabled:bg-palette-lighter"
              >
                ← Prev
              </button>
              <button
                type="button"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full border border-palette-light px-4 py-2 text-sm font-semibold text-palette-dark disabled:opacity-40 hover:enabled:bg-palette-lighter"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'product' && (
        <ProductModal
          product={modal.product || null}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
      {modal?.type === 'stock' && (
        <StockModal
          product={modal.product}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="panel-surface w-full max-w-sm rounded-[2rem] border border-palette-light p-8 shadow-panel">
            <h2 className="text-xl font-semibold text-palette-dark">Delete product?</h2>
            <p className="mt-2 text-sm text-palette-dark/70">
              <strong>{deleteTarget.name}</strong> will be permanently deleted.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-full border border-palette-light px-5 py-2.5 text-sm font-semibold text-palette-dark hover:bg-palette-lighter"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
