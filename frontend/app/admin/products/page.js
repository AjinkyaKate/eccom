'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getErrorMessage, getApiBaseUrl } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

const EMPTY_VARIANT = { name: '', price: '', discountPrice: '', stock: '' };

function buildInitialImages(product) {
  if (!product) return [];
  const urls = Array.isArray(product.images) ? product.images : [];
  const main = product.mainImage;
  const all = main ? [main, ...urls.filter((u) => u !== main)] : urls;
  return all.filter(Boolean).map((url) => ({ url, publicId: null }));
}

function ImageUploader({ images, onChange }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError('');
    const token = window.localStorage.getItem('adminToken');
    const results = [];

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/admin/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Upload failed');
        results.push({ url: data.data.url, publicId: data.data.publicId });
      } catch (err) {
        setUploadError(err.message || 'Upload failed');
      }
    }

    if (results.length > 0) onChange([...images, ...results]);
    setUploading(false);
  };

  const handleRemove = async (index) => {
    const img = images[index];
    const token = window.localStorage.getItem('adminToken');
    if (img.publicId) {
      try {
        await fetch(`${getApiBaseUrl()}/api/admin/upload`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: img.publicId }),
        });
      } catch (_) {}
    }
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-palette-dark">
        Product images {images.length > 0 && <span className="text-palette-dark/50">({images.length} · first = main)</span>}
      </label>
      {images.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          {images.map((img, i) => (
            <div key={i} className="relative">
              <img src={img.url} alt={`image ${i + 1}`} className={`h-16 w-16 rounded-xl object-cover border-2 ${i === 0 ? 'border-palette-primary' : 'border-palette-light'}`} />
              {i === 0 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-palette-primary px-2 py-0.5 text-[10px] font-bold text-white">Main</span>}
              <button type="button" onClick={() => handleRemove(i)} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600">×</button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-full border border-dashed border-palette-primary px-5 py-2 text-sm font-semibold text-palette-primary hover:bg-palette-mist disabled:opacity-60">
        {uploading ? 'Uploading...' : '+ Add images'}
      </button>
      {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
    </div>
  );
}

function VariantsEditor({ variants, onChange }) {
  const add = () => onChange([...variants, { ...EMPTY_VARIANT }]);

  const remove = (i) => onChange(variants.filter((_, idx) => idx !== i));

  const update = (i, field, value) => {
    const next = variants.map((v, idx) => idx === i ? { ...v, [field]: value } : v);
    onChange(next);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-semibold text-palette-dark">Variants</label>
        <button type="button" onClick={add} className="rounded-full bg-palette-lighter px-3 py-1 text-xs font-semibold text-palette-primary hover:bg-palette-light">
          + Add variant
        </button>
      </div>

      {variants.length === 0 && (
        <p className="rounded-xl border border-dashed border-palette-light px-4 py-3 text-sm text-palette-dark/50">
          No variants yet. Click "+ Add variant" to add one (e.g. Phyri, Alphonso).
        </p>
      )}

      <div className="space-y-3">
        {variants.map((v, i) => (
          <div key={i} className="rounded-2xl border border-palette-light bg-palette-mist px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-palette-primary/70">Variant {i + 1}</span>
              <button type="button" onClick={() => remove(i)} className="text-xs font-semibold text-red-500 hover:text-red-700">Remove</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="sm:col-span-4">
                <input
                  required
                  value={v.name}
                  onChange={(e) => update(i, 'name', e.target.value)}
                  className="input-field"
                  placeholder="Variant name (e.g. Alphonso)"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs font-semibold text-palette-dark/70">Price (₹) *</label>
                <input required type="number" min="0" step="0.01" value={v.price} onChange={(e) => update(i, 'price', e.target.value)} className="input-field" placeholder="0.00" />
              </div>
              <div>
                <label className="mb-0.5 block text-xs font-semibold text-palette-dark/70">Discount (₹)</label>
                <input type="number" min="0" step="0.01" value={v.discountPrice} onChange={(e) => update(i, 'discountPrice', e.target.value)} className="input-field" placeholder="Optional" />
              </div>
              <div>
                <label className="mb-0.5 block text-xs font-semibold text-palette-dark/70">Stock</label>
                <input type="number" min="0" value={v.stock} onChange={(e) => update(i, 'stock', e.target.value)} className="input-field" placeholder="0" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductModal({ product, onClose, onSaved }) {
  const isEdit = !!product;
  const [images, setImages] = useState(buildInitialImages(product));
  const [form, setForm] = useState({
    name: product?.name || '',
    shortDescription: product?.shortDescription || '',
    tags: Array.isArray(product?.tags) ? product.tags.join(', ') : '',
    isFeatured: product?.isFeatured ?? false,
    isActive: product?.isActive ?? true,
  });
  const [variants, setVariants] = useState(
    Array.isArray(product?.variants) && product.variants.length > 0
      ? product.variants.map((v) => ({
          name: v.name || '',
          price: v.price ?? '',
          discountPrice: v.discountPrice ?? '',
          stock: v.stock ?? '',
        }))
      : [{ ...EMPTY_VARIANT }]
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
    const imageUrls = images.map((img) => img.url);
    const body = {
      name: form.name,
      shortDescription: form.shortDescription,
      images: imageUrls,
      mainImage: imageUrls[0] || '',
      tags: form.tags,
      isFeatured: form.isFeatured,
      isActive: form.isActive,
      variants: variants.map((v) => ({
        name: v.name,
        price: v.price === '' ? 0 : Number(v.price),
        discountPrice: v.discountPrice === '' ? null : Number(v.discountPrice),
        stock: v.stock === '' ? 0 : Number(v.stock),
      })),
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
          <h2 className="text-xl font-semibold text-palette-dark">{isEdit ? 'Edit product' : 'New product'}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-palette-dark/50 hover:bg-palette-lighter hover:text-palette-dark">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[78vh] overflow-y-auto px-8 py-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-palette-dark">Product name *</label>
              <input required value={form.name} onChange={set('name')} className="input-field" placeholder="e.g. Mango Pulp" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-palette-dark">Short description</label>
              <textarea value={form.shortDescription} onChange={set('shortDescription')} rows={2} className="input-field" placeholder="Brief product summary" />
            </div>

            <ImageUploader images={images} onChange={setImages} />

            <VariantsEditor variants={variants} onChange={setVariants} />

            <div>
              <label className="mb-1 block text-sm font-semibold text-palette-dark">Tags (comma-separated)</label>
              <input value={form.tags} onChange={set('tags')} className="input-field" placeholder="e.g. mango, pulp, premium" />
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

          {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

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

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
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
      const res = await apiFetch(`/api/admin/products?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      setProducts(res?.data?.products || []);
      setPagination(res?.data?.pagination || null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, search, filterActive]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); setSearch(searchInput); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = window.localStorage.getItem('adminToken');
    try {
      await apiFetch(`/api/admin/products/${deleteTarget._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-shell space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeading eyebrow="Catalogue" title="Products" />
        <button type="button" onClick={() => setModal({ type: 'product' })} className="rounded-full bg-palette-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-palette-dark">
          + New product
        </button>
      </div>

      <div className="panel-surface flex flex-wrap items-end gap-4 rounded-2xl border border-palette-light/80 px-5 py-4 shadow-panel">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search products..." className="input-field min-w-0 flex-1" />
          <button type="submit" className="rounded-full bg-palette-primary px-4 py-2 text-sm font-semibold text-white hover:bg-palette-dark">Search</button>
        </form>
        <select value={filterActive} onChange={(e) => { setFilterActive(e.target.value); setPage(1); }} className="input-field w-36">
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="panel-surface rounded-2xl border border-palette-light/80 shadow-panel">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-palette-light text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-palette-primary/70">
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Variants</th>
                <th className="px-6 py-4">Starting price</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-palette-light/70 text-palette-dark">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-palette-dark/50">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-palette-dark/50">No products found.</td></tr>
              ) : products.map((p) => {
                const variants = Array.isArray(p.variants) ? p.variants : [];
                const minPrice = variants.length > 0 ? Math.min(...variants.map((v) => v.discountPrice || v.price)) : p.price;
                return (
                  <tr key={p._id} className="hover:bg-palette-mist">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {p.mainImage ? (
                          <img src={p.mainImage} alt={p.name} className="h-10 w-10 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-palette-lighter text-xs text-palette-primary/50">img</div>
                        )}
                        <p className="font-semibold">{p.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {variants.length === 0 ? (
                        <span className="text-palette-dark/40">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {variants.map((v) => (
                            <span key={v._id} className="rounded-full bg-palette-lighter px-2 py-0.5 text-xs font-semibold text-palette-dark">
                              {v.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      {variants.length > 0 ? `${formatCurrency(minPrice)}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill tone={p.isActive ? 'success' : 'soft'}>{p.isActive ? 'Active' : 'Inactive'}</StatusPill>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setModal({ type: 'product', product: p })} className="rounded-full border border-palette-light px-3 py-1 text-xs font-semibold text-palette-dark transition hover:border-palette-primary hover:text-palette-primary">Edit</button>
                        <button type="button" onClick={() => setDeleteTarget(p)} className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-palette-light px-6 py-4">
            <p className="text-sm text-palette-dark/60">{pagination.totalItems} products · page {pagination.currentPage} of {pagination.totalPages}</p>
            <div className="flex gap-2">
              <button type="button" disabled={!pagination.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-palette-light px-4 py-2 text-sm font-semibold text-palette-dark disabled:opacity-40 hover:enabled:bg-palette-lighter">← Prev</button>
              <button type="button" disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-palette-light px-4 py-2 text-sm font-semibold text-palette-dark disabled:opacity-40 hover:enabled:bg-palette-lighter">Next →</button>
            </div>
          </div>
        )}
      </div>

      {modal?.type === 'product' && (
        <ProductModal product={modal.product || null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="panel-surface w-full max-w-sm rounded-[2rem] border border-palette-light p-8 shadow-panel">
            <h2 className="text-xl font-semibold text-palette-dark">Delete product?</h2>
            <p className="mt-2 text-sm text-palette-dark/70"><strong>{deleteTarget.name}</strong> will be permanently deleted.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-full border border-palette-light px-5 py-2.5 text-sm font-semibold text-palette-dark hover:bg-palette-lighter">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
