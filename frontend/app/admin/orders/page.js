'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';

const statusOptions = ['', 'placed', 'confirmed', 'packed', 'dispatched', 'in_transit', 'delivered', 'cancelled'];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    params.set('page', page);
    params.set('limit', '20');
    return params.toString();
  }, [status, search, page]);

  useEffect(() => {
    let isMounted = true;

    const loadOrders = async () => {
      const token = window.localStorage.getItem('adminToken');
      if (!token) { window.location.href = '/admin/login'; return; }

      setIsLoading(true);
      setError('');

      try {
        const response = await apiFetch(`/api/admin/orders?${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!isMounted) return;

        setOrders(response?.data?.orders || []);
        setStats(response?.data?.stats || null);
        setPagination(response?.data?.pagination || null);
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadOrders();
    return () => { isMounted = false; };
  }, [query]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  return (
    <div className="mx-auto max-w-shell space-y-6 px-6 py-10">
      <SectionHeading eyebrow="Operations" title="Order queue" />

      {/* Filters */}
      <div className="panel-surface rounded-[2rem] border border-palette-light/80 px-6 py-5 shadow-panel">
        <div className="flex flex-wrap items-end gap-4">
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by order # or phone..."
              className="input-field min-w-0 flex-1"
            />
            <button type="submit" className="rounded-full bg-palette-primary px-4 py-2 text-sm font-semibold text-white hover:bg-palette-dark">
              Search
            </button>
          </form>
          <div className="w-48">
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="input-field w-full"
            >
              {statusOptions.map((value) => (
                <option key={value || 'all'} value={value}>
                  {value ? value.replace('_', ' ') : 'All statuses'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {stats && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(stats).map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setStatus(key === status ? '' : key); setPage(1); }}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  status === key
                    ? 'border-palette-primary bg-palette-primary text-white'
                    : 'border-palette-light bg-palette-lighter text-palette-dark hover:border-palette-primary hover:text-palette-primary'
                }`}
              >
                {key.replace('_', ' ')}: {value}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="panel-surface rounded-[2rem] border border-palette-light/80 shadow-panel">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-palette-light text-left">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-palette-primary/70">
                <th className="px-6 py-4">Order</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-palette-light/70 text-sm text-palette-dark">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-palette-dark/50">Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-palette-dark/50">No orders match.</td></tr>
              ) : orders.map((order) => (
                <tr key={order._id} className="hover:bg-palette-mist">
                  <td className="px-6 py-4">
                    <Link href={`/admin/orders/${order._id}`} className="font-semibold text-palette-primary hover:text-palette-dark">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <p>{order.customer?.name || 'Customer'}</p>
                    <p className="text-palette-dark/60">{order.customer?.phone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill>{order.status}</StatusPill>
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill tone={order.payment?.status === 'paid' ? 'success' : order.payment?.status === 'failed' ? 'warn' : 'soft'}>
                      {order.payment?.status || 'pending'}
                    </StatusPill>
                  </td>
                  <td className="px-6 py-4 font-semibold">{formatCurrency(order.pricing?.total || 0)}</td>
                  <td className="px-6 py-4 capitalize text-palette-dark/70">{order.source || 'website'}</td>
                  <td className="px-6 py-4 text-palette-dark/70">{formatDateTime(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-palette-light px-6 py-4">
            <p className="text-sm text-palette-dark/60">
              {pagination.totalItems} orders · page {pagination.currentPage} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full border border-palette-light px-4 py-2 text-sm font-semibold text-palette-dark disabled:opacity-40 hover:enabled:bg-palette-lighter"
              >
                ← Prev
              </button>
              <button
                type="button"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full border border-palette-light px-4 py-2 text-sm font-semibold text-palette-dark disabled:opacity-40 hover:enabled:bg-palette-lighter"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
