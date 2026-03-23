import Link from 'next/link';
import { formatCurrency } from '@/lib/format';

export default function ProductCard({ product }) {
  const price = product.finalPrice || product.discountPrice || product.price || 0;
  const description = product.shortDescription || product.description || 'No description added yet.';
  const imageSrc = product.mainImage || product.images?.[0] || 'https://placehold.co/800x800?text=Product';

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex h-full min-h-80 flex-col overflow-hidden rounded-[1.75rem] border border-palette-light bg-white shadow-panel transition hover:-translate-y-1 hover:shadow-2xl"
    >
      <div className="relative h-64 overflow-hidden border-b border-palette-light">
        <img
          src={imageSrc}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
        />
      </div>
      <div className="relative flex flex-1 flex-col px-5 pb-5 pt-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-palette-primary/60">
          {product.category?.name || 'Product'}
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-palette-primary">{product.name}</h3>
        <p className="mt-3 flex-1 text-base leading-7 text-palette-dark/70">{description}</p>
        <div className="triangle relative ml-auto mt-6 rounded-tl-sm bg-palette-lighter px-5 pb-2 pt-3 text-right">
          <span className="text-sm uppercase tracking-[0.14em] text-palette-dark/55">Starting at</span>
          <p className="mt-1 text-xl font-semibold text-palette-dark">{formatCurrency(price)}</p>
        </div>
      </div>
    </Link>
  );
}
