import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import SectionHeading from '@/components/SectionHeading';
import HeroCta from '@/components/HeroCta';
import { apiFetch, getErrorMessage } from '@/lib/api';

async function loadStorefrontData() {
  try {
    const [categoryResponse, productResponse] = await Promise.all([
      apiFetch('/api/categories',                       { next: { revalidate: 60 } }),
      apiFetch('/api/products?limit=8&featured=true',   { next: { revalidate: 60 } }),
    ]);

    return {
      categories: categoryResponse?.data?.categories || [],
      products: productResponse?.data?.products || [],
      error: null,
    };
  } catch (error) {
    return { categories: [], products: [], error: getErrorMessage(error) };
  }
}

export default async function HomePage() {
  const { categories, products, error } = await loadStorefrontData();

  return (
    <div className="mx-auto flex max-w-shell flex-col gap-14 px-6 py-10">

      {/* Hero */}
      <section className="panel-surface overflow-hidden rounded-[2rem] border border-palette-light/80 shadow-panel">
        <div className="grid gap-8 px-8 py-12 md:grid-cols-[1.3fr_0.7fr] md:px-12 md:py-16">
          <div className="space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-palette-primary/70">
              Wholesale Ordering
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-palette-dark md:text-5xl">
              Quality products,<br />delivered to your door.
            </h1>
            <p className="max-w-lg text-base leading-7 text-palette-dark/70">
              Browse our full catalogue, add items to cart, and place your order in minutes.
              Bulk pricing available on request.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/products"
                className="rounded-full bg-palette-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-palette-dark"
              >
                Browse all products
              </Link>
              <HeroCta />
            </div>
          </div>

          {/* Category quick-links */}
          {categories.length > 0 && (
            <div className="rounded-[1.75rem] border border-palette-light bg-palette-mist p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-palette-primary/60">
                Browse by category
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Link
                    key={cat._id}
                    href={`/products?category=${cat.slug}`}
                    className="flex items-center gap-2 rounded-full border border-palette-light bg-white px-4 py-2 text-sm font-semibold text-palette-dark shadow-sm transition hover:border-palette-primary hover:text-palette-primary"
                  >
                    {cat.image && (
                      <img src={cat.image} alt="" className="h-5 w-5 rounded-full object-cover" />
                    )}
                    {cat.name}
                  </Link>
                ))}
                <Link
                  href="/products"
                  className="rounded-full border border-dashed border-palette-primary px-4 py-2 text-sm font-semibold text-palette-primary transition hover:bg-palette-lighter"
                >
                  All products →
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Featured products */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Catalogue" title="Featured Products" />
          <Link
            href="/products"
            className="text-sm font-semibold text-palette-primary hover:text-palette-dark"
          >
            View all →
          </Link>
        </div>

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
        ) : products.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-palette-light bg-white p-8 text-center text-palette-dark/50">
            No products added yet.
          </div>
        )}
      </section>

      {/* Categories strip */}
      {categories.length > 0 && (
        <section className="space-y-6">
          <SectionHeading eyebrow="Shop by" title="Categories" />
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {categories.filter((c) => c.isActive).map((cat) => (
              <Link
                key={cat._id}
                href={`/products?category=${cat.slug}`}
                className="group flex items-center gap-4 rounded-[1.5rem] border border-palette-light bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-palette-primary hover:shadow-panel"
              >
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-palette-lighter text-xl font-bold text-palette-primary">
                    {cat.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-palette-dark group-hover:text-palette-primary">{cat.name}</p>
                  {cat.description && (
                    <p className="mt-0.5 truncate text-xs text-palette-dark/50">{cat.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
