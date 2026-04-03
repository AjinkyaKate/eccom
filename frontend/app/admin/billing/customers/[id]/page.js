'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { use } from 'react';
import { apiFetch, getErrorMessage } from '@/lib/api';

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateStr = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function CustomerLedgerPage({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  // Manual payment form
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');

  const token = typeof window !== 'undefined' ? window.localStorage.getItem('adminToken') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    setLoading(true);
    apiFetch(`/api/admin/billing/customers/${id}`, { headers })
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const sendWhatsApp = async (isReminder = false) => {
    setActionLoading('whatsapp');
    try {
      const res = await apiFetch(`/api/admin/billing/customers/${id}/whatsapp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ isReminder }),
      });
      showToast(`WhatsApp ${isReminder ? 'reminder' : 'invoice'} sent ✓`);
    } catch (err) {
      showToast('Failed: ' + getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const createPaymentLink = async () => {
    setActionLoading('link');
    try {
      const res = await apiFetch(`/api/admin/billing/customers/${id}/payment-link`, {
        method: 'POST', headers,
        body: JSON.stringify({}),
      });
      const url = res.data.paymentUrl;
      await navigator.clipboard.writeText(url).catch(() => {});
      showToast('Payment link created & copied ✓');
      load();
    } catch (err) {
      showToast('Failed: ' + getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const toggleBlock = async () => {
    const ledger = data?.ledger;
    setActionLoading('block');
    try {
      await apiFetch(`/api/admin/billing/customers/${id}/block`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ blocked: !ledger.isOrderBlocked }),
      });
      showToast(ledger.isOrderBlocked ? 'Customer unblocked ✓' : 'Customer blocked ✓');
      load();
    } catch (err) {
      showToast('Failed: ' + getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const recordPayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) { showToast('Enter a valid amount'); return; }
    setActionLoading('pay');
    try {
      await apiFetch(`/api/admin/billing/customers/${id}/payment`, {
        method: 'POST', headers,
        body: JSON.stringify({ amount: Number(payAmount), paymentMethod: payMethod, referenceId: payRef }),
      });
      showToast('Payment recorded ✓');
      setShowPayForm(false);
      setPayAmount(''); setPayRef('');
      load();
    } catch (err) {
      showToast('Failed: ' + getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const { ledger, paymentLinks = [], whatsappLogs = [] } = data || {};
  if (!ledger) return null;

  const entries = [...(ledger.entries || [])].reverse();

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-16">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm z-50 shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link href="/admin/billing/customers" className="text-gray-400 hover:text-gray-600 text-sm">← Customers</Link>
      </div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{ledger.name || ledger.phone}</h1>
          {ledger.businessName && <p className="text-sm text-gray-500">{ledger.businessName}</p>}
          <p className="text-sm text-gray-400">{ledger.phone}</p>
        </div>
        {ledger.isOrderBlocked && (
          <span className="bg-red-100 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            Order Blocked
          </span>
        )}
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
          <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide mb-1">Outstanding</p>
          <p className="text-lg font-bold text-orange-700">₹{fmt(ledger.outstandingBalance)}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Total Billed</p>
          <p className="text-lg font-bold text-gray-800">₹{fmt(ledger.totalDebits)}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
          <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Total Paid</p>
          <p className="text-lg font-bold text-green-700">₹{fmt(ledger.totalCredits)}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => sendWhatsApp(false)}
          disabled={!!actionLoading || ledger.outstandingBalance <= 0}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium transition-colors"
        >
          {actionLoading === 'whatsapp' ? 'Sending...' : '💬 Send Invoice'}
        </button>
        <button
          onClick={() => sendWhatsApp(true)}
          disabled={!!actionLoading || ledger.outstandingBalance <= 0}
          className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium transition-colors"
        >
          {actionLoading === 'whatsapp' ? '...' : '🔔 Send Reminder'}
        </button>
        <button
          onClick={createPaymentLink}
          disabled={!!actionLoading}
          className="border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50 py-3 rounded-xl text-sm font-medium transition-colors"
        >
          {actionLoading === 'link' ? 'Creating...' : '🔗 New Payment Link'}
        </button>
        <button
          onClick={() => setShowPayForm((v) => !v)}
          className="border border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-xl text-sm font-medium transition-colors"
        >
          ✓ Record Cash/Transfer
        </button>
        <button
          onClick={toggleBlock}
          disabled={!!actionLoading}
          className={`col-span-2 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
            ledger.isOrderBlocked
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'border border-red-300 text-red-600 hover:bg-red-50'
          }`}
        >
          {actionLoading === 'block' ? '...' : ledger.isOrderBlocked ? 'Unblock Customer' : 'Block Customer'}
        </button>
      </div>

      {/* Manual payment form */}
      {showPayForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 space-y-3">
          <p className="font-semibold text-gray-800 text-sm">Record Manual Payment</p>
          <input
            type="number"
            placeholder="Amount (₹)"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
          </select>
          <input
            type="text"
            placeholder="Reference / UTR (optional)"
            value={payRef}
            onChange={(e) => setPayRef(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3">
            <button
              onClick={recordPayment}
              disabled={actionLoading === 'pay'}
              className="flex-1 bg-gray-900 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {actionLoading === 'pay' ? 'Saving...' : 'Record Payment'}
            </button>
            <button
              onClick={() => setShowPayForm(false)}
              className="px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Payment links */}
      {paymentLinks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-4">
          <div className="px-5 py-3 border-b bg-gray-50">
            <p className="font-semibold text-gray-700 text-sm">Payment Links</p>
          </div>
          <div className="divide-y">
            {paymentLinks.map((link) => (
              <div key={link._id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{link.description}</p>
                  <p className="text-xs text-gray-400">{dateStr(link.createdAt)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">₹{fmt(link.amount)}</p>
                  <p className="text-xs text-green-600">Paid: ₹{fmt(link.amountPaid)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    link.status === 'paid' ? 'bg-green-100 text-green-700' :
                    link.status === 'partially_paid' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{link.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ledger entries */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-4">
        <div className="px-5 py-3 border-b bg-gray-50">
          <p className="font-semibold text-gray-700 text-sm">Ledger ({ledger.entries?.length || 0} entries)</p>
        </div>
        {entries.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No entries yet</p>
        ) : (
          <div className="divide-y max-h-96 overflow-y-auto">
            {entries.map((e) => (
              <div key={e._id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{e.description}</p>
                  {e.note && <p className="text-xs text-gray-400 truncate">{e.note}</p>}
                  <p className="text-xs text-gray-400">{dateStr(e.date)}</p>
                </div>
                <p className={`font-bold text-sm flex-shrink-0 ${e.type === 'credit' ? 'text-green-600' : 'text-gray-900'}`}>
                  {e.type === 'credit' ? '+' : '−'} ₹{fmt(e.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp log */}
      {whatsappLogs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <p className="font-semibold text-gray-700 text-sm">WhatsApp Messages</p>
          </div>
          <div className="divide-y">
            {whatsappLogs.map((log) => (
              <div key={log._id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 capitalize">{log.messageType.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-400">{dateStr(log.createdAt)}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                  log.status === 'sent' || log.status === 'delivered' ? 'bg-green-100 text-green-700' :
                  log.status === 'read' ? 'bg-blue-100 text-blue-700' :
                  log.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
