'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { apiFetch, getErrorMessage } from '@/lib/api';

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BillingCustomersPage() {
  const [ledgers, setLedgers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [sendingId, setSendingId] = useState(null);
  const [toast, setToast] = useState('');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (blockedOnly) p.set('blocked', 'true');
    p.set('page', page);
    p.set('limit', '20');
    return p.toString();
  }, [search, blockedOnly, page]);

  const load = () => {
    const token = window.localStorage.getItem('adminToken');
    if (!token) { window.location.href = '/admin/login'; return; }
    setLoading(true);
    setError('');
    apiFetch(`/api/admin/billing/customers?${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setLedgers(res.data.ledgers || []);
        setPagination(res.data.pagination || null);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [query]);

  const sendReminder = async (ledgerId) => {
    const token = window.localStorage.getItem('adminToken');
    setSendingId(ledgerId);
    try {
      await apiFetch(`/api/admin/billing/customers/${ledgerId}/whatsapp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isReminder: true }),
      });
      setToast('Reminder sent ✓');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setToast('Failed: ' + getErrorMessage(err));
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm z-50 shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/billing" className="text-gray-400 hover:text-gray-600 text-sm">← Billing</Link>
        <h1 className="text-xl font-bold text-gray-900">Customers</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <form
          className="flex-1 flex gap-2 min-w-0"
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, phone, business..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
          />
          <button
            type="submit"
            className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
          >
            Search
          </button>
        </form>
        <button
          onClick={() => { setBlockedOnly((v) => !v); setPage(1); }}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            blockedOnly
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-red-400'
          }`}
        >
          {blockedOnly ? '✕ Blocked Only' : 'Blocked Only'}
        </button>
        <Link
          href="/admin/billing/import"
          className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700"
        >
          + Import
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : ledgers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No customers yet</p>
          <Link href="/admin/billing/import" className="text-blue-600 text-sm hover:underline">
            Import outstanding balances →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="divide-y">
            {ledgers.map((l) => (
              <div key={l._id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <Link href={`/admin/billing/customers/${l._id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {l.name || l.phone}
                    </p>
                    {l.isOrderBlocked && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex-shrink-0">
                        Blocked
                      </span>
                    )}
                  </div>
                  {l.businessName && (
                    <p className="text-xs text-gray-400 truncate">{l.businessName}</p>
                  )}
                  <p className="text-xs text-gray-400">{l.phone}</p>
                </Link>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold text-sm ${l.outstandingBalance > 0 ? 'text-gray-900' : 'text-green-600'}`}>
                    ₹{fmt(l.outstandingBalance)}
                  </p>
                  <p className="text-xs text-gray-400">outstanding</p>
                </div>
                {l.outstandingBalance > 0 && (
                  <button
                    onClick={() => sendReminder(l._id)}
                    disabled={sendingId === l._id}
                    className="flex-shrink-0 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-xl font-medium transition-colors"
                    title="Send WhatsApp reminder"
                  >
                    {sendingId === l._id ? '...' : '💬'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-3 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">
            {page} / {pagination.totalPages}
          </span>
          <button
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
