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
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768);
  }, []);

  const fetchInvoiceBlob = async (preview = false) => {
    const token = window.localStorage.getItem('adminToken');
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const qs = preview ? '?preview=1' : '';
    const r = await fetch(`${apiBase}/api/admin/orders/${orderId}/invoice/pdf${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error('Failed to generate invoice PDF');
    return r.blob();
  };

  const handlePreview = async () => {
    setIsPreviewLoading(true);
    setError('');
    try {
      const blob = await fetchInvoiceBlob(true);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setIsPreviewOpen(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await fetchInvoiceBlob(false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${order.invoice?.invoiceNumber || order.orderNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

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
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill>{order?.status}</StatusPill>
          <StatusPill tone={order?.payment?.status === 'paid' ? 'success' : 'soft'}>
            payment {order?.payment?.status}
          </StatusPill>
          {order && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreview}
                disabled={isPreviewLoading}
                className="rounded-full border border-palette-primary bg-white px-4 py-2 text-xs font-semibold text-palette-primary transition hover:bg-palette-lighter disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPreviewLoading ? 'Loading...' : 'Preview Invoice'}
              </button>
              <button
                onClick={handleDownload}
                className="rounded-full border border-palette-light bg-white px-4 py-2 text-xs font-semibold text-palette-dark transition hover:border-palette-primary hover:text-palette-primary"
              >
                Download PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
      ) : null}

      {/* ── Invoice / Bill status banner ── */}
      {order && (
        <div className={`flex items-center justify-between rounded-2xl border px-6 py-4 ${
          order.invoice?.isGenerated
            ? 'border-green-200 bg-green-50'
            : 'border-amber-200 bg-amber-50'
        }`}>
          <div>
            {order.invoice?.isGenerated ? (
              <>
                <p className="text-sm font-semibold text-green-800">Invoice Generated</p>
                <p className="mt-0.5 text-xs text-green-700">
                  {order.invoice.invoiceNumber} &nbsp;·&nbsp; {formatDateTime(order.invoice.generatedAt)}
                  {order.invoice.amount ? ` · ₹${order.invoice.amount}` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-amber-800">Bill Pending</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Invoice will be auto-generated when payment is marked as <strong>paid</strong>.
                  PDF can still be previewed using the order number as reference.
                </p>
              </>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold tracking-wide ${
            order.invoice?.isGenerated
              ? 'bg-green-600 text-white'
              : 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
          }`}>
            {order.invoice?.isGenerated ? 'PAID BILL' : 'BILL PENDING'}
          </span>
        </div>
      )}

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
      {/* ── Invoice preview modal ── */}
      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/70"
          onClick={closePreview}
        >
          {/* Toolbar */}
          <div
            className="flex shrink-0 items-center justify-between bg-white px-4 py-3 shadow-md sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-sm font-semibold text-palette-dark">Invoice Preview</p>
              <p className="text-xs text-palette-dark/50">
                {order.invoice?.invoiceNumber || order.orderNumber}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-full bg-palette-primary px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-palette-dark sm:px-5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span className="hidden sm:inline">Download PDF</span>
                <span className="sm:hidden">Download</span>
              </button>
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden rounded-full border border-palette-light px-4 py-2 text-xs font-semibold text-palette-dark transition hover:border-palette-primary sm:inline-block"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open in Tab
                </a>
              )}
              <button
                onClick={closePreview}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-palette-light text-palette-dark transition hover:border-palette-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* PDF viewer area */}
          <div className="flex flex-1 flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {isMobile ? (
              /* Mobile: PDF iframes are unreliable — show action cards instead */
              <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-gray-100 px-6 py-10">
                <div className="rounded-2xl bg-white p-6 shadow-lg text-center w-full max-w-sm">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-palette-primary/10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-palette-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="mb-1 font-semibold text-palette-dark text-base">Invoice Ready</p>
                  <p className="mb-5 text-sm text-palette-dark/50">
                    {order.invoice?.invoiceNumber || order.orderNumber}
                  </p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleDownload}
                      className="w-full rounded-full bg-palette-primary py-3 text-sm font-semibold text-white shadow transition hover:bg-palette-dark"
                    >
                      Download PDF
                    </button>
                    {previewUrl && (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full rounded-full border border-palette-primary py-3 text-sm font-semibold text-palette-primary text-center transition hover:bg-palette-primary/5"
                      >
                        Open in Browser
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Desktop: embed PDF */
              <object
                data={previewUrl}
                type="application/pdf"
                className="h-full w-full border-0"
                title="Invoice Preview"
              >
                {/* Fallback if browser can't embed */}
                <div className="flex h-full flex-col items-center justify-center gap-4 bg-gray-100">
                  <p className="text-sm text-palette-dark/60">Cannot display PDF in browser.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDownload}
                      className="rounded-full bg-palette-primary px-6 py-2.5 text-sm font-semibold text-white"
                    >
                      Download PDF
                    </button>
                    {previewUrl && (
                      <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                        className="rounded-full border border-palette-primary px-6 py-2.5 text-sm font-semibold text-palette-primary">
                        Open in New Tab
                      </a>
                    )}
                  </div>
                </div>
              </object>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
