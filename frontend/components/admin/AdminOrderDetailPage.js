'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { formatCurrency, formatDateTime, formatCurrencyPaise } from '@/lib/format';

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

/**
 * Helper for numbers to words (Formal Print)
 */
const numberToWords = (n) => {
  if (n === 0) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const k = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + k(n % 100) : '');
    if (n < 100000) return k(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + k(n % 1000) : '');
    if (n < 10000000) return k(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + k(n % 100000) : '');
    return k(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + k(n % 10000000) : '');
  };
  const r = Math.floor(n);
  const p = Math.round((n - r) * 100);
  let res = k(r) + ' Rupees';
  if (p > 0) res += ' and ' + k(p) + ' Paise';
  return res + ' Only';
};

export default function AdminOrderDetailPage({ orderId }) {
  const [order, setOrder] = useState(null);
  const [businessSettings, setBusinessSettings] = useState(null);
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

    try {
      const response = await apiFetch(`/api/admin/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const nextOrder = response?.data?.order || null;
      setOrder(nextOrder);
      setCustomerHistory(response?.data?.customerHistory || null);
      
      // Fetch settings for print layout
      const settingsRes = await apiFetch('/api/admin/settings', {
         headers: { Authorization: `Bearer ${token}` }
      });
      setBusinessSettings(settingsRes?.data?.settings || null);

      setStatusForm((current) => ({
        ...current,
        status: nextOrder?.status || '',
      }));
      setPaymentForm((current) => ({
        ...current,
        status: nextOrder?.payment?.status || 'pending',
        paidAmount: nextOrder?.pricing?.total || '',
      }));
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
      <div className="mx-auto max-w-shell px-6 py-10 text-palette-dark">Loading order...</div>
    );
  }

  const items = order?.items || [];
  const invoiceNo = order?.invoice?.invoiceNumber || order?.orderNumber;
  const dateStr = new Date(order?.invoice?.generatedAt || order?.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Totals for print
  const subtotal = order?.pricing?.subtotal || 0;
  const totalCgst = items.reduce((sum, item) => sum + (item.cgstAmount || 0), 0);
  const totalSgst = items.reduce((sum, item) => sum + (item.sgstAmount || 0), 0);
  const shipping = order?.pricing?.shippingCharges || 0;
  const discount = order?.pricing?.discount || 0;
  const grandTotalRaw = subtotal + totalCgst + totalSgst + shipping - discount;
  const grandTotal = Math.round(grandTotalRaw);
  const roundOff = grandTotal - grandTotalRaw;

  return (
    <div className="mx-auto max-w-shell px-6 py-10 space-y-8">

      {/* 🟢 SCREEN VIEW 🟢 */}
      <div className="print:hidden space-y-8">
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
            <button
              onClick={() => window.print()}
              className="rounded-full bg-palette-ink px-6 py-2 text-xs font-black uppercase tracking-widest text-white shadow-xl transition hover:scale-105"
            >
              Print Official Bill
            </button>
          </div>
        </div>

        {error && <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>}

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
                  <p className="mt-2 text-xl font-semibold text-palette-primary">{formatCurrency(order?.pricing?.total || 0)}</p>
                  <p className="mt-1 text-palette-dark/70">Placed: {formatDateTime(order?.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
               <h2 className="text-2xl font-semibold text-palette-dark">Shipping address</h2>
               <div className="mt-4 rounded-2xl border border-palette-light bg-white p-5 text-base leading-8 text-palette-dark/80">
                  <p className="font-semibold text-palette-dark">{order?.shippingAddress?.name}</p>
                  {order?.shippingAddress?.businessName && <p>{order.shippingAddress.businessName}</p>}
                  <p>{order?.shippingAddress?.street}</p>
                  <p>{order?.shippingAddress?.city}, {order?.shippingAddress?.state} {order?.shippingAddress?.pincode}</p>
                  <p>{order?.shippingAddress?.phone}</p>
               </div>
            </div>

            {/* Items */}
            <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
              <h2 className="text-2xl font-semibold text-palette-dark">Items</h2>
              <div className="mt-4 space-y-4">
                {items.map((item) => (
                  <div key={item._id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-palette-light bg-white p-4">
                    <div className="flex items-center gap-4">
                      <img src={item.image || 'https://placehold.co/200x200?text=Item'} alt={item.name} className="h-16 w-16 rounded-xl object-cover" />
                      <div>
                        <p className="font-semibold text-palette-dark">{item.name}</p>
                        <p className="text-sm text-palette-dark/60">SKU {item.sku} • HSN {item.hsn}</p>
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
            {/* Update Forms */}
            <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
              <h2 className="text-2xl font-semibold text-palette-dark">Update status</h2>
              <form className="mt-5 space-y-4" onSubmit={handleStatusUpdate}>
                 <select
                    value={statusForm.status}
                    onChange={(e) => setStatusForm((c) => ({ ...c, status: e.target.value }))}
                    className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 outline-none"
                  >
                    <option value="">Select next status</option>
                    {(STATUS_TRANSITIONS[order?.status] || []).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="submit" disabled={isUpdating} className="w-full rounded-full bg-palette-primary py-3 text-sm font-bold text-white shadow-lg">
                    {isUpdating ? 'Saving...' : 'Update status'}
                  </button>
              </form>
            </div>

            <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
              <h2 className="text-2xl font-semibold text-palette-dark">Update payment</h2>
              <form className="mt-5 space-y-4" onSubmit={handlePaymentUpdate}>
                  <select
                    value={paymentForm.status}
                    onChange={(e) => setPaymentForm((c) => ({ ...c, status: e.target.value }))}
                    className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 outline-none"
                  >
                    {paymentOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <button type="submit" disabled={isUpdating} className="w-full rounded-full border border-palette-primary py-3 text-sm font-bold text-palette-primary transition hover:bg-palette-mist/20">
                    {isUpdating ? 'Saving...' : 'Save payment'}
                  </button>
              </form>
            </div>
          </section>
        </div>
      </div>

      {/* 🔴 PRINT VIEW: FORMAL BILL 🔴 */}
      <div className="hidden print:block text-black bg-white text-[11px] font-sans leading-tight">
        <div className="border border-black">
          {/* Header */}
          <div className="flex border-b border-black">
            <div className="p-2 border-r border-black flex items-center justify-center w-20">
              <img src="/logo.jpeg" alt="" className="h-16 w-16 object-contain" />
            </div>
            <div className="flex-1 p-2 text-center uppercase">
              <h1 className="text-xl font-bold">{businessSettings?.businessName || 'RAJMANGAL ENTERPRISES'}</h1>
              <p className="text-[9px] mt-1">{businessSettings?.businessAddress || 'RAGA ALTIS, PHASE II, GOLDEN CITY, PAITHAN ROAD, CHHATRAPATI SAMBHAJINAGAR'}</p>
              <p className="text-[10px] font-bold">GST IN-{businessSettings?.gstin || '27BVYPG4144F1ZA'}</p>
            </div>
          </div>

          <div className="flex border-b border-black">
            <div className="flex-1 py-1 text-center text-sm font-bold border-r border-black uppercase bg-gray-100">Bill of Supply</div>
            <div className="w-40 divide-y divide-black text-[8px] px-2 py-1">
              <div>✓ Original for Receipt</div>
              <div>  Duplicate for Transporter</div>
            </div>
          </div>

          <div className="grid grid-cols-2 border-b border-black divide-x divide-black">
            <div className="divide-y divide-black p-1 space-y-1">
              <div>Reverse Charge: No</div>
              <div className="font-bold">Invoice No.: {invoiceNo}</div>
              <div>Invoice Date: {dateStr}</div>
            </div>
            <div className="divide-y divide-black p-1 space-y-1">
              <div>State: MAHARASHTRA (27)</div>
              <div>Place of Supply: </div>
              <div>Date of Supply: {dateStr}</div>
            </div>
          </div>

          <div className="p-1 border-b border-black bg-gray-100 uppercase font-bold text-[9px]">Details of Receiver Billed to :</div>
          <div className="p-2 border-b border-black space-y-1">
            <p className="font-bold">Name: {order?.customer?.name}</p>
            <p>Address: {order?.shippingAddress?.street}, {order?.shippingAddress?.city}</p>
            <p>State: {order?.shippingAddress?.state?.toUpperCase()} ({order?.shippingAddress?.stateCode || '27'})</p>
            <p>GST NO: {order?.shippingAddress?.gstin || ''}</p>
          </div>

          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-black divide-x divide-black text-center font-bold">
                <th className="p-1 w-8">Sr.</th>
                <th className="p-1 text-left">Product</th>
                <th className="p-1">HSN</th>
                <th className="p-1">QTY</th>
                <th className="p-1">Rate</th>
                <th className="p-1">CGST</th>
                <th className="p-1">SGST</th>
                <th className="p-1">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {items.map((item, i) => (
                <tr key={item._id} className="divide-x divide-black text-center h-8">
                  <td>{i+1}</td>
                  <td className="text-left px-1">{item.name}</td>
                  <td>{item.hsn}</td>
                  <td>{item.quantity}</td>
                  <td>{item.price.toFixed(2)}</td>
                  <td>{item.cgstAmount?.toFixed(2)}</td>
                  <td>{item.sgstAmount?.toFixed(2)}</td>
                  <td className="font-bold">{item.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-[1fr_200px] border-t border-black divide-x divide-black">
            <div className="p-2 space-y-4">
              <p className="font-bold italic uppercase">{numberToWords(grandTotal)}</p>
              <div className="text-[9px] border-t border-black pt-2">
                 <p className="font-bold uppercase mb-1">Bank Details:</p>
                 <p>Account Holder: {businessSettings?.bankAccountName || businessSettings?.businessName}</p>
                 <p>A/c: {businessSettings?.bankAccountNumber || '922020012463968'}</p>
                 <p>IFSC: {businessSettings?.bankIfsc || 'UTIB0003541'}</p>
                 <p>Bank: {businessSettings?.bankName || 'AXIS BANK'}</p>
              </div>
            </div>
            <div className="divide-y divide-black text-[10px]">
               <div className="flex justify-between px-2 py-1"><span>Taxable Value:</span><span>{subtotal.toFixed(2)}</span></div>
               <div className="flex justify-between px-2 py-1"><span>CGST:</span><span>{totalCgst.toFixed(2)}</span></div>
               <div className="flex justify-between px-2 py-1"><span>SGST:</span><span>{totalSgst.toFixed(2)}</span></div>
               <div className="flex justify-between px-2 py-1"><span>RoundOff:</span><span>{roundOff.toFixed(2)}</span></div>
               <div className="flex justify-between px-2 py-2 font-bold bg-gray-100 uppercase"><span>Total Amount:</span><span>{grandTotal.toFixed(2)}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-black h-24 divide-x divide-black">
             <div className="p-2 text-[8px]">
                <p className="font-bold mb-1 underline uppercase">Terms & Conditions:</p>
                <p>1. Before Payment transaction please inform payment.</p>
                <p>2. After receiving parcel will be dispatch according to bus schedule.</p>
                <p>3. Our responsibility ceases up to dispatch from Chhatrapati Sambhajinagar.</p>
             </div>
             <div className="p-2 flex flex-col justify-between text-center items-center">
                <p className="text-[8px] italic">Certified that the particular given above are true and correct</p>
                <p className="font-bold text-[9px] uppercase">For, {businessSettings?.businessName || 'RAJMANGAL ENTERPRISES'}</p>
                <p className="border-t border-black w-32 pt-1 text-[8px] mt-4">Authorized Signatory</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
