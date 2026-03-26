'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

export default function AddToCartPanel({ productId, stock }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddToCart = async () => {
    const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

    if (!token) {
      router.push('/login?redirect=/cart');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setAdded(false);

    try {
      await apiFetch('/api/cart/add', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId, quantity }),
      });

      setAdded(true);
      // Tell navbar to refresh cart count
      window.dispatchEvent(new CustomEvent('cart:updated'));
      setTimeout(() => setAdded(false), 3000);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[2rem] border border-palette-light bg-white p-6 shadow-panel">
      <h2 className="text-2xl font-semibold text-palette-dark">Add to Cart</h2>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <input
          type="number"
          min="1"
          max={stock || 1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))}
          className="w-28 rounded-2xl border border-palette-light bg-palette-mist px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
        />
        <button
          type="button"
          disabled={isSubmitting || stock <= 0}
          onClick={handleAddToCart}
          className="rounded-full bg-palette-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-palette-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {stock <= 0 ? 'Out of stock' : isSubmitting ? 'Adding...' : 'Add to cart'}
        </button>
      </div>

      {added && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-semibold text-emerald-700">
            Added! View your cart in the top navigation bar.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm font-semibold text-red-700">{error}</p>
      )}
    </div>
  );
}
