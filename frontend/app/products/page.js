'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { apiFetch, getErrorMessage } from '@/lib/api';

function CategoryFilter({ categories, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange('')}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
          !active
            ? 'bg-palette-primary text-white'
            : 'border border-palette-light bg-white text-palette-dark hover:border-palette-primary hover:text-palette-primary'
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat._id}
          type="button"
          onClick={() => onChange(cat.slug)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            active === cat.slug
              ? 'bg-palette-primary text-white'
              : 'border border-palette-light bg-white text-palette-dark hover:border-palette-primary hover:text-palette-primary'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}

function ProductsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);

  // Load categories once — cache in sessionStorage so it's instant on repeat visits
  useEffect(() => {
    const cached = sessionStorage.getItem('_cats');
    if (cached) { try { setCategories(JSON.parse(cached)); } catch {} }
    apiFetch('/api/categories', { next: { revalidate: 60 } })
      .then((res) => {
        const cats = res?.data?.categories || [];
        setCategories(cats);
        sessionStorage.setItem('_cats', JSON.stringify(cats));
      })
      .catch(() => {});
  }, []);

  // Sync URL params → state on navigation
  useEffect(() => {
    const q = searchParams.get('search') || '';
    const cat = searchParams.get('category') || '';
    setSearch(q);
    setSearchInput(q);
    setCategory(cat);
    setPage(1);
  }, [searchParams]);

  // Load products
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    params.set('page', page);
    params.set('limit', '12');

    const endpoint = search
      ? `/api/products/search?${params}`
      : `/api/products?${params}`;

    apiFetch(endpoint)
      .then((res) => {
        if (!isMounted) return;
        setProducts(res?.data?.products || []);
        setPagination(res?.data?.pagination || null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [search, category, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchInput.trim();
    setPage(1);
    setSearch(q);
    setCategory('');
    // update URL
    const params = new URLSearchParams();
    if (q) params.set('search', q);
    router.push(`/products${params.size ? '?' + params : ''}`);
  };

  const handleCategoryChange = (slug) => {
    setPage(1);
    setCategory(slug);
    setSearch('');
    setSearchInput('');
    const params = new URLSearchParams();
    if (slug) params.set('category', slug);
    router.push(`/products${params.size ? '?' + params : ''}`);
  };

  const totalPages = pagination?.totalPages || 1;

  return (
    <div className="mx-auto max-w-shell space-y-8 px-6 py-10">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-palette-primary/60">Catalogue</p>
          <h1 className="mt-1 text-3xl font-semibold text-palette-dark">
            {search ? `Results for "${search}"` : category ? (categories.find(c => c.slug === category)?.name || 'Products') : 'All Products'}
          </h1>
          {pagination && (
            <p className="mt-1 text-sm text-palette-dark/50">{pagination.totalItems} products</p>
          )}
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex w-full max-w-sm gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products..."
            className="input-field flex-1"
          />
          <button
            type="submit"
            className="rounded-full bg-palette-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-palette-dark"
          >
            Search
          </button>
        </form>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <CategoryFilter categories={categories} active={category} onChange={handleCategoryChange} />
      )}

      {/* Error */}
      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-[1.75rem] border border-palette-light bg-white" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-palette-light bg-white p-12 text-center">
          <p className="text-lg font-semibold text-palette-dark/50">No products found.</p>
          {(search || category) && (
            <button
              type="button"
              onClick={() => handleCategoryChange('')}
              className="mt-4 text-sm font-semibold text-palette-primary hover:text-palette-dark"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-full border border-palette-light px-5 py-2.5 text-sm font-semibold text-palette-dark transition hover:bg-palette-lighter disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-palette-dark/60">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-palette-light px-5 py-2.5 text-sm font-semibold text-palette-dark transition hover:bg-palette-lighter disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProductsPageWrapper() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-shell px-6 py-16 text-palette-dark/50">Loading...</div>}>
      <ProductsPage />
    </Suspense>
  );
}
