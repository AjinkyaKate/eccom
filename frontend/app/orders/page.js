'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [customerToken, setCustomerToken] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadOrders = async () => {
      const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

      if (isMounted) {
        setCustomerToken(token);
      }

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await apiFetch('/api/orders', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (isMounted) {
          setOrders(response?.data?.orders || []);
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

    loadOrders();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!loading && !customerToken) {
    return (
      <div className="mx-auto max-w-shell px-6 py-12">
        <div className="rounded-[2rem] border border-palette-light bg-white p-8 shadow-panel">
          <SectionHeading
            eyebrow="Orders"
            title="Login first to view your orders"
            description="The order history API is customer-protected."
          />
          <div className="mt-6">
            <Link
              href="/login?redirect=/orders"
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
        <SectionHeading
          eyebrow="Customer history"
          title="My orders"
          description="This list comes from GET /api/orders and mirrors what the customer website will show after checkout."
        />
      </section>

      {error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div> : null}

      <section className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
        {loading ? (
          <p className="text-palette-dark/70">Loading orders...</p>
        ) : orders.length ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link
                key={order._id}
                href={`/orders/${order._id}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-palette-light bg-white p-5 transition hover:border-palette-primary"
              >
                <div>
                  <p className="text-lg font-semibold text-palette-primary">{order.orderNumber}</p>
                  <p className="mt-1 text-sm text-palette-dark/65">{formatDateTime(order.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill>{order.status}</StatusPill>
                  <StatusPill tone={order.payment?.status === 'paid' ? 'success' : 'soft'}>
                    {order.payment?.status}
                  </StatusPill>
                  <span className="font-semibold text-palette-dark">{formatCurrency(order.pricing?.total || 0)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-palette-light bg-white p-6 text-palette-dark/75">
            No orders yet.
          </div>
        )}
      </section>
    </div>
  );
}
