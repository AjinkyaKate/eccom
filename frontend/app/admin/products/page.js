'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getErrorMessage, getApiBaseUrl } from '@/lib/api';

function ImageUploader({ initialImages = [], onChange }) {
  const fileInputRef = useRef(null);
  const [images, setImages] = useState(initialImages.map(url => ({ url, publicId: null })));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');
    const token = window.localStorage.getItem('adminToken');
    const newImages = [...images];

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${getApiBaseUrl()}/api/admin/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Upload failed');
        
        newImages.push({ url: data.data.url, publicId: data.data.publicId });
      }
      setImages(newImages);
      onChange(newImages.map(img => img.url));
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = async (index) => {
    const img = images[index];
    const token = window.localStorage.getItem('adminToken');
    
    // Optional: Delete from Cloudinary if we have publicId
    if (img.publicId) {
      try {
        await apiFetch('/api/admin/upload', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ publicId: img.publicId }),
        });
      } catch (err) {
        console.warn('Failed to delete image from cloud:', err);
      }
    }

    const next = images.filter((_, i) => i !== index);
    setImages(next);
    onChange(next.map(img => img.url));
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-palette-dark">Product Images</label>
      
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div key={i} className="relative group">
            <img 
              src={img.url} 
              alt="Product" 
              className={`h-20 w-20 rounded-xl object-cover border-2 ${i === 0 ? 'border-palette-primary' : 'border-palette-light'}`} 
            />
            {i === 0 && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-palette-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">Main</span>
            )}
            <button 
              type="button"
              onClick={() => removeImage(i)}
              className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition"
            >
              ×
            </button>
          </div>
        ))}
        
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="h-20 w-20 rounded-xl border-2 border-dashed border-palette-light flex flex-col items-center justify-center text-palette-dark/40 hover:border-palette-primary hover:text-palette-primary transition group disabled:opacity-50"
        >
          {uploading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-palette-primary border-t-transparent"></div>
          ) : (
            <>
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[10px] font-bold uppercase mt-1">Upload</span>
            </>
          )}
        </button>
      </div>
      
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*" 
        multiple 
        className="hidden" 
        onChange={handleUpload} 
      />
      
      {error && <p className="text-xs font-bold text-red-500">{error}</p>}
      <p className="text-[10px] text-palette-dark/40 font-medium">Tip: The first image will be the main cover image.</p>
    </div>
  );
}

function ProductModal({ product, onClose, onSaved }) {
  const isEdit = !!product;
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    priceDisplay: product?.priceDisplay || '',
    images: product?.images || [],
    isActive: product?.isActive ?? true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleImagesChange = (newImages) => {
    setForm(prev => ({ ...prev, images: newImages }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const token = window.localStorage.getItem('adminToken');
    const body = {
      name: form.name,
      description: form.description,
      priceDisplay: form.priceDisplay,
      images: form.images,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm transition-all">
      <div className="panel-surface w-full max-w-lg rounded-[2.5rem] border border-palette-light shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between border-b border-palette-light px-8 py-6">
          <h2 className="text-xl font-bold text-palette-dark">{isEdit ? 'Edit Product' : 'Add New Product'}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-palette-dark/40 hover:bg-palette-lighter hover:text-palette-dark transition">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-palette-dark">Product Name *</label>
            <input required value={form.name} onChange={set('name')} className="input-field py-3.5" placeholder="e.g. Fresh Alphonso Mango" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-palette-dark">Price Display *</label>
            <input required value={form.priceDisplay} onChange={set('priceDisplay')} className="input-field py-3.5" placeholder="e.g. Rs 160 per kg" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-palette-dark">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={3} className="input-field py-3.5 resize-none" placeholder="Product details" />
          </div>

          <ImageUploader initialImages={form.images} onChange={handleImagesChange} />

          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-palette-dark py-2">
            <input type="checkbox" checked={form.isActive} onChange={set('isActive')} className="h-5 w-5 rounded-lg accent-palette-primary" />
            Show on website
          </label>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>}

          <div className="mt-6 flex gap-3 pt-4 border-t border-palette-light/50">
            <button type="submit" disabled={saving} className="flex-1 rounded-full bg-palette-primary px-6 py-4 text-sm font-bold text-white shadow-lg shadow-palette-primary/20 transition hover:bg-palette-dark disabled:opacity-60">
              {saving ? 'Saving...' : isEdit ? 'Update Product' : 'Add Product'}
            </button>
            <button type="button" onClick={onClose} className="rounded-full border border-palette-light px-8 py-4 text-sm font-bold text-palette-dark transition hover:bg-palette-lighter">
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('adminToken');
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/admin/products', { headers: { Authorization: `Bearer ${token}` } });
      setProducts(res?.data?.products || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const token = window.localStorage.getItem('adminToken');
    try {
      await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      load();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-shell space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeading eyebrow="Catalogue" title="Products" />
        <button 
          type="button" 
          onClick={() => setModal({ show: true })} 
          className="rounded-full bg-palette-primary px-6 py-3 text-sm font-bold text-white transition shadow-lg shadow-palette-primary/20 hover:bg-palette-dark"
        >
          + New Product
        </button>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600 border-l-4">{error}</div>}

      <div className="panel-surface rounded-[2rem] border border-palette-light/80 shadow-panel overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-palette-light text-left text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-palette-primary/60 bg-palette-mist/30">
                <th className="px-8 py-5">Product Info</th>
                <th className="px-8 py-5">Price</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-palette-light/70 text-palette-dark">
              {isLoading ? (
                <tr><td colSpan={4} className="px-8 py-16 text-center text-palette-dark/40 font-medium italic">Loading catalogue...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-16 text-center text-palette-dark/40 font-medium italic">No products found.</td></tr>
              ) : products.map((p) => (
                <tr key={p._id} className="hover:bg-palette-mist/40 transition group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-12 w-12 rounded-xl object-cover border border-palette-light shadow-sm" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-palette-lighter text-[10px] font-bold text-palette-primary/40 uppercase">No Img</div>
                      )}
                      <div>
                        <p className="font-bold text-palette-dark leading-tight">{p.name}</p>
                        <p className="mt-1 text-xs text-palette-dark/40 truncate max-w-[240px] font-medium">{p.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="font-bold text-palette-dark">{p.priceDisplay}</span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <StatusPill tone={p.isActive ? 'success' : 'soft'}>{p.isActive ? 'Active' : 'Inactive'}</StatusPill>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <button 
                        onClick={() => setModal({ show: true, product: p })} 
                        className="rounded-xl border border-palette-light px-4 py-2 text-xs font-bold text-palette-dark transition hover:border-palette-primary hover:text-palette-primary bg-white shadow-sm"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(p._id)} 
                        className="rounded-xl border border-red-100 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 bg-white shadow-sm"
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

      {modal?.show && (
        <ProductModal product={modal.product} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}
