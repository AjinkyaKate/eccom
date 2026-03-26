import Link from 'next/link';
import { notFound } from 'next/navigation';
import AddToCartPanel from '@/components/AddToCartPanel';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import ProductImageGallery from '@/components/ProductImageGallery';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

async function loadProduct(slug) {
  try {
    const response = await apiFetch(`/api/products/${slug}`);
    return {
      product: response?.data?.product || null,
      error: null,
    };
  } catch (error) {
    return {
      product: null,
      error: getErrorMessage(error),
    };
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { product } = await loadProduct(slug);

  return {
    title: product ? `${product.name} | Eccom Wholesale` : 'Product | Eccom Wholesale',
  };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const { product, error } = await loadProduct(slug);

  if (!product && !error) {
    notFound();
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-shell px-6 py-16">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>
      </div>
    );
  }

  const price = product.discountPrice && product.discountPrice > 0 ? product.discountPrice : product.price;

  return (
    <div className="mx-auto max-w-shell px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <ProductImageGallery
          images={product.images}
          mainImage={product.mainImage}
          name={product.name}
        />
        <div className="space-y-6">
          <div className="space-y-4">
            <Link href="/products" className="text-sm font-semibold text-palette-primary hover:text-palette-dark">
              ← Back to products
            </Link>
            <StatusPill tone={product.stock > 0 ? 'soft' : 'warn'}>
              {product.stock > 0 ? `${product.stock} units in stock` : 'Out of stock'}
            </StatusPill>
            <SectionHeading
              eyebrow={product.category?.name || 'Product'}
              title={product.name}
              description={product.shortDescription || product.description || 'No product description added yet.'}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-palette-light bg-white p-5 shadow-panel">
              <p className="text-sm text-palette-dark/65">Current price</p>
              <p className="mt-3 text-3xl font-semibold text-palette-primary">{formatCurrency(price)}</p>
            </div>
            <div className="rounded-3xl border border-palette-light bg-white p-5 shadow-panel">
              <p className="text-sm text-palette-dark/65">SKU</p>
              <p className="mt-3 text-xl font-semibold text-palette-dark">{product.sku}</p>
            </div>
          </div>
          {product.description && (
            <div className="rounded-[2rem] border border-palette-light bg-white p-6 shadow-panel">
              <h2 className="text-base font-semibold text-palette-dark">Description</h2>
              <p className="mt-2 text-sm leading-7 text-palette-dark/75">{product.description}</p>
            </div>
          )}
          <AddToCartPanel productId={product._id} stock={product.stock} />
        </div>
      </div>
    </div>
  );
}
