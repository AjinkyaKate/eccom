import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getErrorMessage } from '@/lib/api';

async function loadStorefrontData() {
  try {
    const [categoryResponse, productResponse] = await Promise.all([
      apiFetch('/api/categories'),
      apiFetch('/api/products?limit=8'),
    ]);

    return {
      categories: categoryResponse?.data?.categories || [],
      products: productResponse?.data?.products || [],
      error: null,
    };
  } catch (error) {
    return {
      categories: [],
      products: [],
      error: getErrorMessage(error),
    };
  }
}

export default async function HomePage() {
  const { categories, products, error } = await loadStorefrontData();

  return (
    <div className="mx-auto flex max-w-shell flex-col gap-12 px-6 py-10">
      <section className="panel-surface overflow-hidden rounded-[2rem] border border-palette-light/80 shadow-panel">
        <div className="grid gap-8 px-8 py-10 md:grid-cols-[1.2fr_0.8fr] md:px-12 md:py-14">
          <div className="space-y-6">
            <StatusPill tone="soft">Connected to local APIs</StatusPill>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-palette-dark md:text-6xl">
                Build the full B2B ordering flow on top of the backend you already finished.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-palette-dark/75">
                This frontend shell reads your real categories, products, orders, and admin stats from the
                Express server. We kept the reference palette and typography, but rebuilt the UI around your own
                API contracts.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/dashboard"
                className="rounded-full bg-palette-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-palette-dark"
              >
                Open admin dashboard
              </Link>
              <Link
                href="/admin/login"
                className="rounded-full border border-palette-primary px-6 py-3 text-sm font-semibold text-palette-primary transition hover:bg-palette-lighter"
              >
                Login as admin
              </Link>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-palette-light bg-palette-mist p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-palette-primary/70">
              Local system status
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-palette-light bg-white p-4">
                <p className="text-sm text-palette-dark/65">Categories</p>
                <p className="mt-2 text-3xl font-semibold text-palette-dark">{categories.length}</p>
              </div>
              <div className="rounded-2xl border border-palette-light bg-white p-4">
                <p className="text-sm text-palette-dark/65">Products loaded</p>
                <p className="mt-2 text-3xl font-semibold text-palette-dark">{products.length}</p>
              </div>
              <div className="rounded-2xl border border-palette-light bg-white p-4 sm:col-span-2">
                <p className="text-sm text-palette-dark/65">Flow ready</p>
                <p className="mt-2 text-base leading-7 text-palette-dark/80">
                  Public catalog, admin login, dashboard, order list, and order detail pages are already wired to
                  the backend.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Browse"
          title="Live category data from MongoDB"
          description="These chips come directly from the public categories API, so any admin-side changes will show up here on refetch."
        />
        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <span
                key={category._id}
                className="rounded-full border border-palette-light bg-white px-4 py-2 text-sm font-semibold text-palette-dark shadow-sm"
              >
                {category.name}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Catalog"
          title="Featured storefront products"
          description="This grid reads from GET /api/products. Product cards are styled from the reference repo but mapped to your backend fields."
        />
        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
