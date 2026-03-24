'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SectionHeading from '@/components/SectionHeading';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

export default function CartPage() {
  const [cart, setCart] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [customerToken, setCustomerToken] = useState(null);

  const loadCart = async () => {
    const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

    if (!token) {
      setCart(null);
      setLoading(false);
      return;
    }

    const response = await apiFetch('/api/cart', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setCart(response?.data?.cart || { items: [], subtotal: 0, totalItems: 0 });
  };

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

      if (isMounted) {
        setCustomerToken(token);
      }

      try {
        await loadCart();
      } catch (loadError) {
        if (isMounted) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateQuantity = async (itemId, quantity) => {
    try {
      const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

      await apiFetch(`/api/cart/items/${itemId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity }),
      });

      await loadCart();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    }
  };

  const removeItem = async (itemId) => {
    try {
      const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

      await apiFetch(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      await loadCart();
    } catch (removeError) {
      setError(getErrorMessage(removeError));
    }
  };

  const clearCart = async () => {
    try {
      const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

      await apiFetch('/api/cart', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      await loadCart();
    } catch (clearError) {
      setError(getErrorMessage(clearError));
    }
  };

  if (!loading && !customerToken) {
    return (
      <div className="mx-auto max-w-shell px-6 py-12">
        <div className="rounded-[2rem] border border-palette-light bg-white p-8 shadow-panel">
          <SectionHeading
            eyebrow="Cart"
            title="Login to view your cart"
            description="Please login to access your cart."
          />
          <div className="mt-6">
            <Link
              href="/login?redirect=/cart"
              className="rounded-full bg-palette-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-palette-dark"
            >
              Login with OTP
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-shell space-y-8 px-6 py-10">
      <section className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionHeading eyebrow="Shopping" title="Your Cart" />
          <button
            type="button"
            onClick={clearCart}
            className="rounded-full border border-palette-primary px-4 py-2 text-sm font-semibold text-palette-primary transition hover:bg-palette-lighter"
          >
            Clear cart
          </button>
        </div>
      </section>

      {error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div> : null}

      <section className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
        {loading ? (
          <p className="text-palette-dark/70">Loading cart...</p>
        ) : cart?.items?.length ? (
          <div className="space-y-5">
            {cart.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-palette-light bg-white p-4"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={item.product.mainImage || 'https://placehold.co/200x200?text=Item'}
                    alt={item.product.name}
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                  <div>
                    <Link href={`/products/${item.product.slug}`} className="text-lg font-semibold text-palette-primary">
                      {item.product.name}
                    </Link>
                    <p className="mt-1 text-sm text-palette-dark/60">
                      {formatCurrency(item.price)} each • stock {item.product.stock}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-full border border-palette-light bg-palette-lighter">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      className="px-4 py-2 text-palette-dark"
                    >
                      −
                    </button>
                    <span className="min-w-10 text-center font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-4 py-2 text-palette-dark"
                    >
                      +
                    </button>
                  </div>
                  <p className="min-w-24 text-right font-semibold text-palette-dark">{formatCurrency(item.subtotal)}</p>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-full border border-palette-primary px-4 py-2 text-sm font-semibold text-palette-primary transition hover:bg-palette-lighter"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-palette-light bg-palette-lighter p-6">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-palette-primary/70">Cart summary</p>
                <p className="mt-2 text-3xl font-semibold text-palette-dark">{formatCurrency(cart.subtotal || 0)}</p>
              </div>
              <Link
                href="/checkout"
                className="rounded-full bg-palette-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-palette-dark"
              >
                Proceed to checkout
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-palette-light bg-white p-6 text-palette-dark/75">
            Your cart is empty right now.
          </div>
        )}
      </section>
    </div>
  );
}
