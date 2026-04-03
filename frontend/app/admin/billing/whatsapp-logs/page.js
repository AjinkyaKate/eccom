'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { apiFetch, getErrorMessage } from '@/lib/api';

const STATUS_COLORS = {
  queued: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  read: 'bg-purple-100 text-purple-700',
  failed: 'bg-red-100 text-red-700',
};

const TYPE_LABELS = {
  invoice_sent: 'Invoice',
  payment_reminder: 'Reminder',
  payment_confirmed: 'Confirmed',
  order_placed: 'Order',
  order_status_update: 'Status Update',
  custom: 'Custom',
};

export default function WhatsAppLogsPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);

  const token = typeof window !== 'undefined' ? window.localStorage.getItem('adminToken') : '';

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter) p.set('status', statusFilter);
    if (typeFilter) p.set('messageType', typeFilter);
    p.set('page', page);
    p.set('limit', '30');
    return p.toString();
  }, [statusFilter, typeFilter, page]);

  useEffect(() => {
    setLoading(true);
    setError('');
    apiFetch(`/api/admin/billing/whatsapp-logs?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        setLogs(res.data.logs || []);
        setPagination(res.data.pagination || null);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-16">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/billing" className="text-gray-400 hover:text-gray-600 text-sm">← Billing</Link>
        <h1 className="text-xl font-bold text-gray-900">WhatsApp Logs</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {['queued', 'sent', 'delivered', 'read', 'failed'].map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No messages logged yet</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="divide-y">
            {logs.map((log) => (
              <div key={log._id}>
                <button
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpanded(expanded === log._id ? null : log._id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-gray-800">
                        {log.customerName || log.phone}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[log.status]}`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {TYPE_LABELS[log.messageType] || log.messageType} ·{' '}
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    <p className="text-xs text-gray-400">{log.phone}</p>
                  </div>
                  <span className="text-gray-400 text-xs ml-3">{expanded === log._id ? '▲' : '▼'}</span>
                </button>

                {expanded === log._id && (
                  <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-2 mt-3">Message:</p>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white border border-gray-200 rounded-xl p-3">
                      {log.renderedBody}
                    </pre>
                    {log.failedReason && (
                      <p className="text-xs text-red-600 mt-2">Error: {log.failedReason}</p>
                    )}
                    {log.greenApiMessageId && (
                      <p className="text-xs text-gray-400 mt-1">Message ID: {log.greenApiMessageId}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pagination?.totalPages > 1 && (
        <div className="flex justify-center gap-3 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">{page} / {pagination.totalPages}</span>
          <button
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
