'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

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
  const [error, setError] = useState('');
  const [statusForm, setStatusForm] = useState({ status: '', note: '' });
  const [paymentForm, setPaymentForm] = useState({ status: '', note: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  const loadOrder = async () => {
    const token = window.localStorage.getItem('adminToken');
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }

    try {
      const response = await apiFetch(`/api/admin/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const nextOrder = response?.data?.order || null;
      setOrder(nextOrder);
      
      setStatusForm({
        status: nextOrder?.status || '',
        note: '',
      });
      setPaymentForm({
        status: nextOrder?.payment?.status || 'pending',
        note: '',
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const handleStatusUpdate = async (event) => {
    event.preventDefault();
    setError('');
    setIsUpdating(true);
    try {
      const token = window.localStorage.getItem('adminToken');
      await apiFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(paymentForm),
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
      <div className="mx-auto max-w-shell px-6 py-10 text-palette-dark">Loading order...</div>
    );
  }

  const items = order?.items || [];

  return (
    <div className="mx-auto max-w-shell px-6 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-3">
          <Link href="/admin/orders" className="text-sm font-semibold text-palette-primary hover:text-palette-dark">
            ← Back to orders
          </Link>
          <SectionHeading eyebrow="Order detail" title={order?.orderNumber || 'Order'} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill>{order?.status}</StatusPill>
          <StatusPill tone={order?.payment?.status === 'paid' ? 'success' : 'soft'}>
            payment {order?.payment?.status}
          </StatusPill>
        </div>
      </div>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>}

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-palette-light bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-palette-primary/50">Customer</p>
                <p className="mt-2 text-xl font-bold text-palette-dark">{order?.customer?.name || 'Customer'}</p>
                <p className="mt-1 text-sm font-medium text-palette-dark/70">{order?.customer?.phone}</p>
                <p className="text-sm font-medium text-palette-dark/70">{order?.customer?.email}</p>
              </div>
              <div className="rounded-2xl border border-palette-light bg-white p-4 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-palette-primary/50">Placed On</p>
                <p className="mt-2 text-sm font-bold text-palette-dark">{formatDateTime(order?.createdAt)}</p>
                <p className="mt-1 text-[10px] font-bold text-palette-primary uppercase">{order?.source} source</p>
              </div>
            </div>
          </div>

          <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
             <h2 className="text-2xl font-bold text-palette-dark">Delivery Address</h2>
             <div className="mt-4 rounded-2xl border border-palette-light bg-white p-5 text-base leading-relaxed text-palette-dark/80">
                <p className="font-bold text-palette-dark">{order?.shippingAddress?.name}</p>
                {order?.shippingAddress?.businessName && <p className="font-medium italic">{order.shippingAddress.businessName}</p>}
                <p className="mt-1">{order?.shippingAddress?.street}</p>
                <p>{order?.shippingAddress?.city}, {order?.shippingAddress?.state} {order?.shippingAddress?.pincode}</p>
                <p className="mt-2 font-bold text-palette-primary">{order?.shippingAddress?.phone}</p>
             </div>
          </div>

          <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
            <h2 className="text-2xl font-bold text-palette-dark">Order Items</h2>
            <div className="mt-4 space-y-4">
              {items.map((item) => (
                <div key={item._id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-palette-light bg-white p-4">
                  <div className="flex items-center gap-4">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-16 w-16 rounded-xl object-cover border border-palette-light" />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-palette-lighter flex items-center justify-center text-[10px] font-bold text-palette-primary/40 uppercase">No Img</div>
                    )}
                    <div>
                      <p className="font-bold text-palette-dark">{item.name}</p>
                      <p className="text-xs font-bold text-palette-primary mt-0.5">{item.price}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-palette-dark">x{item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
            <h2 className="text-lg font-bold text-palette-dark mb-4">Update Status</h2>
            <form className="space-y-4" onSubmit={handleStatusUpdate}>
               <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm((c) => ({ ...c, status: e.target.value }))}
                  className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-sm font-bold text-palette-dark outline-none focus:border-palette-primary"
                >
                  <option value="">Select next status</option>
                  {(STATUS_TRANSITIONS[order?.status] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="submit" disabled={isUpdating} className="w-full rounded-full bg-palette-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-palette-primary/20 transition hover:bg-palette-dark disabled:opacity-50">
                  {isUpdating ? 'Saving...' : 'Update Status'}
                </button>
            </form>
          </div>

          <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
            <h2 className="text-lg font-bold text-palette-dark mb-4">Update Payment</h2>
            <form className="space-y-4" onSubmit={handlePaymentUpdate}>
                <select
                  value={paymentForm.status}
                  onChange={(e) => setPaymentForm((c) => ({ ...c, status: e.target.value }))}
                  className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-sm font-bold text-palette-dark outline-none focus:border-palette-primary"
                >
                  {paymentOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <button type="submit" disabled={isUpdating} className="w-full rounded-full border-2 border-palette-primary py-3.5 text-sm font-bold text-palette-primary transition hover:bg-palette-mist/20 disabled:opacity-50">
                  {isUpdating ? 'Saving...' : 'Save Payment'}
                </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
