'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/lib/api';

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const StatCard = ({ label, value, sub, color = 'blue', href }) => {
  const colors = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    red: 'bg-red-50 border-red-100 text-red-700',
    green: 'bg-green-50 border-green-100 text-green-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
  };
  const card = (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
};

export default function BillingDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = window.localStorage.getItem('adminToken');
    if (!token) { window.location.href = '/admin/login'; return; }

    apiFetch('/api/admin/billing/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setStats(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Collections, payments & WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/billing/import"
            className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            + Import Customers
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Total Outstanding"
          value={`₹${fmt(stats?.totalOutstanding)}`}
          color="orange"
          href="/admin/billing/customers"
        />
        <StatCard
          label="Blocked Customers"
          value={stats?.blockedCustomers ?? '—'}
          sub="Order blocked"
          color="red"
          href="/admin/billing/customers?blocked=true"
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'All Customers', icon: '👥', href: '/admin/billing/customers' },
          { label: 'WhatsApp Logs', icon: '💬', href: '/admin/billing/whatsapp-logs' },
          { label: 'Templates', icon: '📝', href: '/admin/billing/templates' },
          { label: 'Bulk Import', icon: '📥', href: '/admin/billing/import' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="font-medium text-gray-800 text-sm">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Overdue customers */}
      {stats?.overdueCustomers?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
            <p className="font-semibold text-gray-700 text-sm">Top Outstanding</p>
            <Link href="/admin/billing/customers" className="text-xs text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y">
            {stats.overdueCustomers.map((c) => (
              <Link
                key={c._id}
                href={`/admin/billing/customers/${c._id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{c.name || c.phone}</p>
                  {c.businessName && <p className="text-xs text-gray-400">{c.businessName}</p>}
                  <p className="text-xs text-gray-400">{c.phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">₹{fmt(c.outstandingBalance)}</p>
                  {c.isOrderBlocked && (
                    <span className="text-xs text-red-600 font-medium">Blocked</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent payments */}
      {stats?.recentPayments?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <p className="font-semibold text-gray-700 text-sm">Recent Payments</p>
          </div>
          <div className="divide-y">
            {stats.recentPayments.map((p) => (
              <div key={p._id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{p.customerName || p.customerPhone}</p>
                  <p className="text-xs text-gray-400">{new Date(p.updatedAt).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">₹{fmt(p.amountPaid)}</p>
                  <p className="text-xs text-gray-400">of ₹{fmt(p.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
