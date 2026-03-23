'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

export default function CustomerOrderDetailPage({ orderId }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [customerToken, setCustomerToken] = useState(null);

  const loadOrder = async () => {
    const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

    if (!token) {
      setLoading(false);
      return;
    }

    const response = await apiFetch(`/api/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setOrder(response?.data?.order || null);
  };

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

      if (isMounted) {
        setCustomerToken(token);
      }

      try {
        await loadOrder();
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
  }, [orderId]);

  const handleCancel = async () => {
    setIsCancelling(true);
    setError('');

    try {
      const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);
      await apiFetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'Cancelled from customer UI' }),
      });
      await loadOrder();
    } catch (cancelError) {
      setError(getErrorMessage(cancelError));
    } finally {
      setIsCancelling(false);
    }
  };

  if (!loading && !customerToken) {
    return (
      <div className="mx-auto max-w-shell px-6 py-12">
        <div className="rounded-[2rem] border border-palette-light bg-white p-8 shadow-panel">
          <SectionHeading
            eyebrow="Order detail"
            title="Login first to view this order"
            description="Customer order detail is also a protected route."
          />
          <div className="mt-6">
            <Link
              href={`/login?redirect=/orders/${orderId}`}
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
      <div className="space-y-3">
        <Link href="/orders" className="text-sm font-semibold text-palette-primary hover:text-palette-dark">
          ← Back to my orders
        </Link>
        <SectionHeading
          eyebrow="Order detail"
          title={order?.orderNumber || 'Customer order'}
          description="This page reads the order snapshot the backend stored at checkout, so future customer edits do not rewrite old order history."
        />
      </div>

      {error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div> : null}

      {loading ? (
        <div className="rounded-3xl border border-palette-light bg-white p-6 text-palette-dark/70">Loading order...</div>
      ) : order ? (
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill>{order.status}</StatusPill>
                <StatusPill tone={order.payment?.status === 'paid' ? 'success' : 'soft'}>
                  payment {order.payment?.status}
                </StatusPill>
              </div>
              <div className="mt-5 space-y-4">
                {order.items?.map((item) => (
                  <div key={item._id} className="rounded-2xl border border-palette-light bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold text-palette-dark">{item.name}</p>
                      <p className="text-palette-dark/70">Qty {item.quantity}</p>
                    </div>
                    <p className="mt-2 text-sm text-palette-dark/65">{formatCurrency(item.subtotal || 0)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
              <h2 className="text-2xl font-semibold text-palette-dark">Tracking timeline</h2>
              <div className="mt-5 space-y-4">
                {order.statusHistory?.map((entry, index) => (
                  <div key={`${entry.status}-${entry.createdAt}-${index}`} className="rounded-2xl border border-palette-light bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <StatusPill>{entry.status}</StatusPill>
                      <p className="text-sm text-palette-dark/60">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    {entry.note ? <p className="mt-3 text-palette-dark/75">{entry.note}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
              <h2 className="text-2xl font-semibold text-palette-dark">Delivery snapshot</h2>
              <div className="mt-5 rounded-2xl border border-palette-light bg-white p-4 text-base leading-7 text-palette-dark/80">
                <p className="font-semibold text-palette-dark">{order.shippingAddress?.name}</p>
                {order.shippingAddress?.businessName ? <p>{order.shippingAddress.businessName}</p> : null}
                <p>{order.shippingAddress?.street}</p>
                <p>
                  {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.pincode}
                </p>
                <p>{order.shippingAddress?.phone}</p>
              </div>
              <div className="mt-5 rounded-2xl border border-palette-light bg-palette-lighter p-4">
                <p className="text-sm uppercase tracking-[0.18em] text-palette-primary/70">Total</p>
                <p className="mt-2 text-3xl font-semibold text-palette-dark">
                  {formatCurrency(order.pricing?.total || 0)}
                </p>
              </div>
            </div>

            {(order.status === 'placed' || order.status === 'confirmed') ? (
              <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
                <h2 className="text-2xl font-semibold text-palette-dark">Need to cancel?</h2>
                <p className="mt-3 text-base leading-7 text-palette-dark/75">
                  Customer-side cancellation is only available while the order is still early in the flow.
                </p>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="mt-5 rounded-full border border-palette-primary px-5 py-3 text-sm font-semibold text-palette-primary transition hover:bg-palette-lighter disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel order'}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <div className="rounded-3xl border border-palette-light bg-white p-6 text-palette-dark/75">
          Order not found.
        </div>
      )}
    </div>
  );
}
