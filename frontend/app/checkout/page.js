'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SectionHeading from '@/components/SectionHeading';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

const defaultAddress = {
  name: '',
  businessName: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
  deliveryInstructions: '',
  type: 'shop',
};

export default function CheckoutPage() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [address, setAddress] = useState(defaultAddress);
  const [error, setError] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customerToken, setCustomerToken] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async () => {
      const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

      if (isMounted) {
        setCustomerToken(token);
      }

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await apiFetch('/api/orders/checkout/summary', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!isMounted) {
          return;
        }

        const checkout = response?.data?.checkout || null;
        setSummary(checkout);

        const firstSavedAddress = checkout?.savedAddresses?.[0];
        if (firstSavedAddress) {
          setAddress((current) => ({
            ...current,
            ...firstSavedAddress,
          }));
        }
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

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCheckout = async (event) => {
    event.preventDefault();
    setIsPlacing(true);
    setError('');

    try {
      const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

      const response = await apiFetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentMethod: 'COD',
          shippingAddress: address,
        }),
      });

      router.push(`/orders/${response?.data?.order?._id}`);
    } catch (checkoutError) {
      setError(getErrorMessage(checkoutError));
    } finally {
      setIsPlacing(false);
    }
  };

  if (!loading && !customerToken) {
    return (
      <div className="mx-auto max-w-shell px-6 py-12">
        <div className="rounded-[2rem] border border-palette-light bg-white p-8 shadow-panel">
          <SectionHeading
            eyebrow="Checkout"
            title="Login to checkout"
            description="Please login first to place your order."
          />
          <div className="mt-6">
            <Link
              href="/login?redirect=/checkout"
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeading eyebrow="Checkout" title="Place Your Order" />
        <Link href="/cart" className="text-sm font-semibold text-palette-primary hover:text-palette-dark">
          ← Back to cart
        </Link>
      </div>

      {error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div> : null}

      {loading ? (
        <div className="rounded-3xl border border-palette-light bg-white p-6 text-palette-dark/70">Loading checkout summary...</div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel"
            onSubmit={handleCheckout}
          >
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(address).map(([key, value]) => (
                <div key={key} className={key === 'deliveryInstructions' || key === 'street' ? 'md:col-span-2' : ''}>
                  <label className="mb-2 block text-sm font-semibold capitalize text-palette-dark" htmlFor={key}>
                    {key.replace(/([A-Z])/g, ' $1')}
                  </label>
                  {key === 'deliveryInstructions' || key === 'street' ? (
                    <textarea
                      id={key}
                      value={value}
                      onChange={(event) => setAddress((current) => ({ ...current, [key]: event.target.value }))}
                      className="min-h-24 w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
                    />
                  ) : (
                    <input
                      id={key}
                      value={value}
                      onChange={(event) => setAddress((current) => ({ ...current, [key]: event.target.value }))}
                      className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              type="submit"
              disabled={isPlacing || !summary?.canCheckout}
              className="mt-6 rounded-full bg-palette-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-palette-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPlacing ? 'Placing order...' : 'Place COD order'}
            </button>
          </form>

          <section className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
            <h2 className="text-2xl font-semibold text-palette-dark">Order summary</h2>
            <div className="mt-5 space-y-4">
              {summary?.items?.map((item) => (
                <div key={item.cartItemId} className="rounded-2xl border border-palette-light bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold text-palette-dark">{item.name}</p>
                    <p className="text-palette-dark/70">Qty {item.quantity}</p>
                  </div>
                  <p className="mt-2 text-sm text-palette-dark/65">{formatCurrency(item.subtotal || 0)}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-palette-light bg-palette-lighter p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-palette-primary/70">Payable now</p>
              <p className="mt-2 text-3xl font-semibold text-palette-dark">
                {formatCurrency(summary?.pricing?.total || 0)}
              </p>
              <p className="mt-2 text-sm text-palette-dark/70">Payment method: COD</p>
            </div>
            {summary?.issues?.length ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {summary.issues.map((issue) => issue.message).join(', ')}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
