'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

export default function AddToCartPanel({ productId, stock }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
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
    setMessage('');

    try {
      await apiFetch('/api/cart/add', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId,
          quantity,
        }),
      });

      setMessage('Added to cart successfully.');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[2rem] border border-palette-light bg-white p-6 shadow-panel">
      <h2 className="text-2xl font-semibold text-palette-dark">Ready to order?</h2>
      <p className="mt-3 text-base leading-7 text-palette-dark/75">
        Use the real cart API now. The only thing still deferred is the smarter location flow; manual checkout
        address works already.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <input
          type="number"
          min="1"
          max={stock || 1}
          value={quantity}
          onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))}
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
        <Link
          href="/cart"
          className="rounded-full border border-palette-primary px-6 py-3 text-sm font-semibold text-palette-primary transition hover:bg-palette-lighter"
        >
          Open cart
        </Link>
      </div>
      {message ? <p className="mt-4 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
