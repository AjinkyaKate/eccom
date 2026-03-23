'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';

const STATUS_TRANSITIONS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['dispatched', 'cancelled'],
  dispatched: ['in_transit'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
};

const paymentOptions = ['pending', 'paid', 'failed', 'refunded'];

export default function AdminOrderDetailPage({ orderId }) {
  const [order, setOrder] = useState(null);
  const [customerHistory, setCustomerHistory] = useState(null);
  const [error, setError] = useState('');
  const [statusForm, setStatusForm] = useState({ status: '', note: '' });
  const [paymentForm, setPaymentForm] = useState({ status: '', note: '', paidAmount: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  const loadOrder = async () => {
    const token = window.localStorage.getItem('adminToken');

    if (!token) {
      window.location.href = '/admin/login';
      return;
    }

    const response = await apiFetch(`/api/admin/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const nextOrder = response?.data?.order || null;
    setOrder(nextOrder);
    setCustomerHistory(response?.data?.customerHistory || null);
    setStatusForm((current) => ({
      ...current,
      status: nextOrder?.status || '',
    }));
    setPaymentForm((current) => ({
      ...current,
      status: nextOrder?.payment?.status || 'pending',
      paidAmount: nextOrder?.pricing?.total || '',
    }));
  };

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        await loadOrder();
      } catch (loadError) {
        if (isMounted) {
          setError(getErrorMessage(loadError));
        }
      }
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const handleStatusUpdate = async (event) => {
    event.preventDefault();
    setError('');
    setIsUpdating(true);

    try {
      const token = window.localStorage.getItem('adminToken');
      await apiFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(statusForm),
      });
      await loadOrder();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePaymentUpdate = async (event) => {
    event.preventDefault();
    setError('');
    setIsUpdating(true);

    try {
      const token = window.localStorage.getItem('adminToken');
      await apiFetch(`/api/admin/orders/${orderId}/payment`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...paymentForm,
          paidAmount: paymentForm.paidAmount === '' ? undefined : Number(paymentForm.paidAmount),
        }),
      });
      await loadOrder();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setIsUpdating(false);
    }
  };

  if (!order && !error) {
    return (
      <div className="mx-auto max-w-shell px-6 py-10">
        <div className="rounded-3xl border border-palette-light bg-white p-6 text-palette-dark">Loading order...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-shell space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-3">
          <Link href="/admin/orders" className="text-sm font-semibold text-palette-primary hover:text-palette-dark">
            ← Back to orders
          </Link>
          <SectionHeading
            eyebrow="Order detail"
            title={order?.orderNumber || 'Order'}
            description="This page fetches one order document and lets the admin update order and payment state using the real backend rules."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill>{order?.status}</StatusPill>
          <StatusPill tone={order?.payment?.status === 'paid' ? 'success' : 'soft'}>
            payment {order?.payment?.status}
          </StatusPill>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-palette-light bg-white p-4">
                <p className="text-sm text-palette-dark/65">Customer</p>
                <p className="mt-2 text-xl font-semibold text-palette-dark">{order?.customer?.name || 'Customer'}</p>
                <p className="mt-1 text-palette-dark/70">{order?.customer?.phone}</p>
                <p className="text-palette-dark/70">{order?.customer?.email}</p>
              </div>
              <div className="rounded-2xl border border-palette-light bg-white p-4">
                <p className="text-sm text-palette-dark/65">Order total</p>
                <p className="mt-2 text-xl font-semibold text-palette-primary">
                  {formatCurrency(order?.pricing?.total || 0)}
                </p>
                <p className="mt-1 text-palette-dark/70">Placed: {formatDateTime(order?.createdAt)}</p>
              </div>
            </div>
          </div>

          <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
            <h2 className="text-2xl font-semibold text-palette-dark">Shipping address</h2>
            <div className="mt-4 rounded-2xl border border-palette-light bg-white p-5 text-base leading-8 text-palette-dark/80">
              <p className="font-semibold text-palette-dark">{order?.shippingAddress?.name}</p>
              {order?.shippingAddress?.businessName ? <p>{order.shippingAddress.businessName}</p> : null}
              <p>{order?.shippingAddress?.street}</p>
              <p>
                {order?.shippingAddress?.city}, {order?.shippingAddress?.state} {order?.shippingAddress?.pincode}
              </p>
              <p>{order?.shippingAddress?.phone}</p>
              {order?.shippingAddress?.landmark ? <p>Landmark: {order.shippingAddress.landmark}</p> : null}
            </div>
          </div>

          <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
            <h2 className="text-2xl font-semibold text-palette-dark">Items</h2>
            <div className="mt-4 space-y-4">
              {order?.items?.map((item) => (
                <div
                  key={item._id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-palette-light bg-white p-4"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={item.image || 'https://placehold.co/200x200?text=Item'}
                      alt={item.name}
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                    <div>
                      <p className="font-semibold text-palette-dark">{item.name}</p>
                      <p className="text-sm text-palette-dark/60">SKU {item.sku}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-palette-dark">Qty {item.quantity}</p>
                    <p className="text-sm text-palette-dark/60">{formatCurrency(item.subtotal || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <form
            className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel"
            onSubmit={handleStatusUpdate}
          >
            <h2 className="text-2xl font-semibold text-palette-dark">Update order status</h2>
            <div className="mt-5 space-y-4">
              {(() => {
                const validNext = STATUS_TRANSITIONS[order?.status] || [];
                const isTerminal = validNext.length === 0;
                if (isTerminal) {
                  return (
                    <p className="rounded-2xl border border-palette-light bg-palette-lighter px-4 py-3 text-sm text-palette-dark/70">
                      This order is <strong>{order?.status}</strong> — no further status changes allowed.
                    </p>
                  );
                }
                return (
                  <select
                    value={statusForm.status}
                    onChange={(event) => setStatusForm((current) => ({ ...current, status: event.target.value }))}
                    className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
                  >
                    <option value="">Select next status</option>
                    {validNext.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                );
              })()}
              <textarea
                value={statusForm.note}
                onChange={(event) => setStatusForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Optional admin note"
                className="min-h-28 w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
              />
              <button
                type="submit"
                disabled={isUpdating}
                className="rounded-full bg-palette-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-palette-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUpdating ? 'Saving...' : 'Save status'}
              </button>
            </div>
          </form>

          <form
            className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel"
            onSubmit={handlePaymentUpdate}
          >
            <h2 className="text-2xl font-semibold text-palette-dark">Update payment</h2>
            <div className="mt-5 space-y-4">
              <select
                value={paymentForm.status}
                onChange={(event) => setPaymentForm((current) => ({ ...current, status: event.target.value }))}
                className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
              >
                {paymentOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={paymentForm.paidAmount}
                onChange={(event) => setPaymentForm((current) => ({ ...current, paidAmount: event.target.value }))}
                placeholder="Paid amount"
                className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
              />
              <textarea
                value={paymentForm.note}
                onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Payment note"
                className="min-h-28 w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
              />
              <button
                type="submit"
                disabled={isUpdating}
                className="rounded-full border border-palette-primary px-5 py-3 text-sm font-semibold text-palette-primary transition hover:bg-palette-lighter disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUpdating ? 'Saving...' : 'Save payment'}
              </button>
            </div>
          </form>

          <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
            <h2 className="text-2xl font-semibold text-palette-dark">Timeline</h2>
            <div className="mt-5 space-y-4">
              {order?.statusHistory?.map((entry, index) => (
                <div key={`${entry.status}-${entry.createdAt}-${index}`} className="rounded-2xl border border-palette-light bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <StatusPill>{entry.status}</StatusPill>
                    <p className="text-sm text-palette-dark/60">{formatDateTime(entry.createdAt)}</p>
                  </div>
                  {entry.note ? <p className="mt-3 text-base text-palette-dark/75">{entry.note}</p> : null}
                </div>
              ))}
            </div>
          </div>

          {customerHistory ? (
            <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
              <h2 className="text-2xl font-semibold text-palette-dark">Customer history</h2>
              <p className="mt-2 text-sm text-palette-dark/70">
                Total orders: {customerHistory.totalOrders}
              </p>
              <div className="mt-4 space-y-3">
                {customerHistory.recentOrders?.map((recentOrder) => (
                  <div key={recentOrder._id} className="rounded-2xl border border-palette-light bg-white p-4">
                    <p className="font-semibold text-palette-dark">{recentOrder.orderNumber}</p>
                    <p className="mt-1 text-sm text-palette-dark/65">
                      {recentOrder.status} • {formatCurrency(recentOrder.pricing?.total || 0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
