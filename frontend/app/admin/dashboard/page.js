'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import MetricCard from '@/components/MetricCard';
import SectionHeading from '@/components/SectionHeading';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      const token = window.localStorage.getItem('adminToken');
      if (!token) return;

      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [statsResponse, orderResponse] = await Promise.all([
          apiFetch('/api/admin/dashboard/stats', { headers }),
          apiFetch('/api/admin/orders?limit=5', { headers }),
        ]);

        if (!isMounted) return;

        setStats(statsResponse?.data || null);
        setOrders(orderResponse?.data?.orders || []);
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDashboard();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="flex h-full flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading eyebrow="Admin workspace" title="Operations dashboard" />
        <Link
          href="/admin/orders"
          className="rounded-full border border-palette-light bg-palette-lighter px-4 py-2 text-sm font-semibold text-palette-dark transition hover:border-palette-primary hover:text-palette-primary"
        >
          View all orders
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total orders"
          value={isLoading ? '...' : stats?.overview?.totalOrders ?? 0}
        />
        <MetricCard
          label="Pending payments"
          value={isLoading ? '...' : stats?.overview?.pendingPayments ?? 0}
        />
        <MetricCard
          label="Today revenue"
          value={isLoading ? '...' : formatCurrency(stats?.today?.revenue ?? 0)}
        />
        <MetricCard
          label="Customers"
          value={isLoading ? '...' : stats?.overview?.totalCustomers ?? 0}
        />
      </section>

      <section className="panel-surface rounded-2xl border border-palette-light/80 px-5 py-3 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-palette-primary/60">Live status — Order flow</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(stats?.ordersByStatus || {}).map(([status, count]) => (
            <div
              key={status}
              className="rounded-full border border-palette-light bg-white px-3 py-1 text-xs font-semibold text-palette-dark"
            >
              {status.replace('_', ' ')}: {count}
            </div>
          ))}
        </div>
      </section>

      <section className="panel-surface flex min-h-0 flex-1 flex-col rounded-2xl border border-palette-light/80 px-5 py-3 shadow-panel">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-palette-primary/60">Recent — Latest order activity</p>
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          <table className="min-w-full divide-y divide-palette-light text-left">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-palette-primary/70">
                <th className="pb-3">Order</th>
                <th className="pb-3">Customer</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Payment</th>
                <th className="pb-3">Total</th>
                <th className="pb-3">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-palette-light/70 text-sm text-palette-dark">
              {orders.map((order) => (
                <tr key={order._id}>
                  <td className="py-2">
                    <Link href={`/admin/orders/${order._id}`} className="font-semibold text-palette-primary hover:text-palette-dark">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="py-2">
                    <p>{order.customer?.name || order.customer?.email || 'Customer'}</p>
                    <p className="text-palette-dark/60">{order.customer?.phone}</p>
                  </td>
                  <td className="py-2">
                    <StatusPill>{order.status}</StatusPill>
                  </td>
                  <td className="py-2">
                    <StatusPill tone={order.payment?.status === 'paid' ? 'success' : 'soft'}>
                      {order.payment?.status || 'pending'}
                    </StatusPill>
                  </td>
                  <td className="py-2 font-semibold">{formatCurrency(order.pricing?.total || 0)}</td>
                  <td className="py-2 text-palette-dark/70">{formatDateTime(order.createdAt)}</td>
                </tr>
              ))}
              {!isLoading && orders.length === 0 ? (
                <tr>
                  <td className="py-6 text-palette-dark/70" colSpan="6">
                    No orders found yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
