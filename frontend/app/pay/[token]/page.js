'use client';

import { useEffect, useState, use } from 'react';
import { apiFetch, getApiBaseUrl } from '@/lib/api';
import { formatCurrencyPaise } from '@/lib/format';

/**
 * ── MODERN WEB COMPONENTS ──────────────────────────────────────────────────
 * These are shown on screen (mobile/desktop) but hidden during print.
 */

const ModernStatusBanner = ({ status }) => {
  const map = {
    active: ['from-amber-500 to-orange-600', 'Payment Pending'],
    partially_paid: ['from-blue-500 to-indigo-600', 'Partially Paid'],
    paid: ['from-emerald-500 to-teal-600', 'Payment Success'],
    expired: ['from-gray-500 to-slate-600', 'Expired'],
    cancelled: ['from-red-500 to-rose-600', 'Cancelled'],
  };
  const [cls, label] = map[status] || ['from-gray-500 to-slate-600', status];

  return (
    <div className={`mb-8 overflow-hidden rounded-3xl bg-gradient-to-r p-1 shadow-lg ${cls}`}>
      <div className="flex items-center justify-between rounded-[1.4rem] bg-white/90 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className={`h-3 w-3 rounded-full animate-pulse bg-gradient-to-r ${cls}`} />
          <span className="text-sm font-black uppercase tracking-widest text-palette-ink">{label}</span>
        </div>
        <div className="hidden rounded-full bg-black/5 px-3 py-1 text-[10px] font-bold uppercase tracking-tighter text-black/40 sm:block">
          Live Tracking
        </div>
      </div>
    </div>
  );
};

const ModernMetric = ({ label, value, sub, highlight = false }) => (
  <div className={`rounded-3xl border p-6 transition-all ${highlight ? 'border-palette-primary/20 bg-palette-mist/30 shadow-sm' : 'border-palette-light/60 bg-white'}`}>
    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-palette-dark/40">{label}</p>
    <p className={`mt-2 text-2xl font-black tracking-tight ${highlight ? 'text-palette-primary' : 'text-palette-ink'}`}>{value}</p>
    {sub && <p className="mt-1 text-xs font-medium text-palette-dark/50">{sub}</p>}
  </div>
);

/**
 * ── FORMAL PRINT COMPONENTS ────────────────────────────────────────────────
 * These are hidden on screen but shown during print.
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

/**
 * ── MAIN PAGE ──────────────────────────────────────────────────────────────
 */

export default function PaymentPage({ params }) {
  const { token } = use(params);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/pay/${token}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message || 'Invoice not found'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="flex min-h-[70vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-palette-primary border-t-transparent" /></div>
  );

  if (error) return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-black text-palette-ink">Oops!</h1>
      <p className="mt-2 text-palette-dark/60">{error}</p>
    </div>
  );

  const order = data.order || {};
  const isPaid = data.status === 'paid';
  const items = order.items || [];
  const invoiceNo = order.invoice?.invoiceNumber || order.orderNumber;
  const dateStr = new Date(order.invoice?.generatedAt || order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Totals
  const subtotal = order.pricing?.subtotal || 0;
  const totalCgst = items.reduce((sum, item) => sum + (item.cgstAmount || 0), 0);
  const totalSgst = items.reduce((sum, item) => sum + (item.sgstAmount || 0), 0);
  const shipping = order.pricing?.shippingCharges || 0;
  const discount = order.pricing?.discount || 0;
  const grandTotalRaw = subtotal + totalCgst + totalSgst + shipping - discount;
  const grandTotal = Math.round(grandTotalRaw);
  const roundOff = grandTotal - grandTotalRaw;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12">

      {/* 🟢 SCREEN VIEW: MODERN & COOL 🟢 */}
      <div className="print:hidden">
        <ModernStatusBanner status={data.status} />
        
        <div className="mb-10 flex flex-col items-center justify-between gap-6 md:flex-row md:items-end">
          <div className="text-center md:text-left">
            <img src="/logo.jpeg" alt="" className="mx-auto h-20 w-20 rounded-3xl object-contain shadow-xl md:mx-0" />
            <h1 className="mt-4 text-3xl font-black tracking-tight text-palette-ink">{data.businessName}</h1>
            <p className="mt-1 text-sm font-bold text-palette-primary/60 uppercase tracking-widest">Digital Bill • #{invoiceNo}</p>
          </div>
          <div className="flex flex-col items-center gap-2 md:items-end">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-2xl bg-palette-ink px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl transition hover:scale-105 active:scale-95"
            >
              Print Official Bill
            </button>
            <p className="text-[10px] font-bold text-palette-dark/40 uppercase">A4 Format Available</p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          <ModernMetric label="Total Amount" value={formatCurrencyPaise(grandTotal)} />
          <ModernMetric label="Amount Paid" value={formatCurrencyPaise(data.amountPaid)} />
          <ModernMetric label="Balance Due" value={formatCurrencyPaise(isPaid ? 0 : data.amountDue)} highlight={!isPaid} />
        </div>

        {/* Modern Items List */}
        <div className="rounded-[2.5rem] border border-palette-light/60 bg-white p-2 shadow-panel">
          <div className="px-6 py-4">
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-palette-dark/30">Order Items</h3>
          </div>
          <div className="space-y-1">
            {items.map((item) => (
              <div key={item._id} className="flex items-center justify-between rounded-[2rem] p-6 transition hover:bg-palette-mist/20">
                <div className="flex-1">
                  <p className="text-lg font-black text-palette-ink">{item.name}</p>
                  <p className="mt-1 text-xs font-bold text-palette-dark/40 uppercase tracking-widest">
                    {item.quantity} {item.unit || 'PCS'} × {formatCurrencyPaise(item.price)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-palette-ink">{formatCurrencyPaise(item.subtotal)}</p>
                  {item.hsn && <p className="text-[10px] font-bold text-palette-primary/50 uppercase">HSN: {item.hsn}</p>}
                </div>
              </div>
            ))}
          </div>
          
          {/* Action Footer */}
          <div className="mt-4 rounded-[2rem] bg-palette-ink p-8 text-white">
             {!isPaid && data.razorpayPaymentLinkUrl ? (
               <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                 <div>
                   <p className="text-xs font-bold uppercase tracking-widest text-white/40">Ready to pay?</p>
                   <p className="text-2xl font-black">Pay {formatCurrencyPaise(data.amountDue)}</p>
                 </div>
                 <a href={data.razorpayPaymentLinkUrl} className="w-full rounded-2xl bg-palette-primary px-10 py-4 text-center text-sm font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-white hover:text-palette-ink md:w-auto">
                   Pay Now
                 </a>
               </div>
             ) : (
               <div className="flex items-center gap-4">
                 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                 </div>
                 <p className="text-lg font-black uppercase tracking-widest">Fully Paid. Thank you!</p>
               </div>
             )}
          </div>
        </div>

        <p className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.3em] text-palette-dark/20">
          Powered by Rajmangal Wholesale
        </p>
      </div>


      {/* 🔴 PRINT VIEW: FORMAL & OFFICIAL 🔴 */}
      {/* This section is only visible during browser printing */}
      <div className="hidden print:block text-black bg-white text-[11px] font-sans leading-tight">
        <div className="border border-black">
          {/* Header */}
          <div className="flex border-b border-black">
            <div className="p-2 border-r border-black flex items-center justify-center w-20">
              <img src="/logo.jpeg" alt="" className="h-16 w-16 object-contain" />
            </div>
            <div className="flex-1 p-2 text-center uppercase">
              <h1 className="text-xl font-bold">{data.businessName}</h1>
              <p className="text-[9px] mt-1">{data.businessAddress || 'RAGA ALTIS, PHASE II, GOLDEN CITY, PAITHAN ROAD, CHHATRAPATI SAMBHAJINAGAR'}</p>
              <p className="text-[10px] font-bold">GST IN-{data.gstin || '27BVYPG4144F1ZA'}</p>
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
              <div className="flex justify-between"><span>Reverse Charge: No</span></div>
              <div className="flex justify-between font-bold"><span>Invoice No.: {invoiceNo}</span></div>
              <div className="flex justify-between"><span>Invoice Date: {dateStr}</span></div>
            </div>
            <div className="divide-y divide-black p-1 space-y-1">
              <div className="flex justify-between"><span>State: MAHARASHTRA (27)</span></div>
              <div className="flex justify-between"><span>Place of Supply: </span></div>
              <div className="flex justify-between"><span>Date of Supply: {dateStr}</span></div>
            </div>
          </div>

          <div className="p-1 border-b border-black bg-gray-100 uppercase font-bold text-[9px]">Details of Receiver Billed to :</div>
          <div className="p-2 border-b border-black space-y-1">
            <p className="font-bold">Name: {data.customerName}</p>
            <p>Address: {order.shippingAddress?.street}, {order.shippingAddress?.city}</p>
            <p>State: {order.shippingAddress?.state?.toUpperCase()} ({order.shippingAddress?.stateCode || '27'})</p>
            <p>GST NO: {order.shippingAddress?.gstin || ''}</p>
          </div>

          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-black divide-x divide-black text-center font-bold">
                <th className="p-1">Sr.</th>
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
                <tr key={i} className="divide-x divide-black text-center h-8">
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
              <p className="font-bold italic">{numberToWords(grandTotal)}</p>
              <div className="text-[9px] border-t border-black pt-2">
                 <p className="font-bold">Bank Details:</p>
                 <p>A/c: {data.bankAccountNumber || '922020012463968'}</p>
                 <p>IFSC: {data.bankIfsc || 'UTIB0003541'}</p>
              </div>
            </div>
            <div className="divide-y divide-black text-[10px]">
               <div className="flex justify-between px-2 py-1"><span>Taxable:</span><span>{subtotal.toFixed(2)}</span></div>
               <div className="flex justify-between px-2 py-1"><span>CGST:</span><span>{totalCgst.toFixed(2)}</span></div>
               <div className="flex justify-between px-2 py-1"><span>SGST:</span><span>{totalSgst.toFixed(2)}</span></div>
               <div className="flex justify-between px-2 py-1"><span>RoundOff:</span><span>{roundOff.toFixed(2)}</span></div>
               <div className="flex justify-between px-2 py-2 font-bold bg-gray-100"><span>TOTAL:</span><span>{grandTotal.toFixed(2)}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-black h-24 divide-x divide-black">
             <div className="p-2 text-[8px]">
                <p className="font-bold mb-1 underline">Terms:</p>
                <p>1. Inform before payment.</p>
                <p>2. Dispatch as per bus schedule.</p>
             </div>
             <div className="p-2 flex flex-col justify-between text-center items-center">
                <p className="text-[8px]">For, {data.businessName}</p>
                <p className="border-t border-black w-32 pt-1 text-[8px]">Authorized Signatory</p>
             </div>
          </div>
        </div>
      </div>

    </div>
  );
}
