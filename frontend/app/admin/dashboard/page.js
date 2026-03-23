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
    <div className="mx-auto max-w-shell space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeading eyebrow="Admin workspace" title="Operations dashboard" />
        <Link
          href="/admin/orders"
          className="rounded-full border border-palette-light bg-palette-lighter px-4 py-2 text-sm font-semibold text-palette-dark transition hover:border-palette-primary hover:text-palette-primary"
        >
          View all orders
        </Link>
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total orders"
          value={isLoading ? '...' : stats?.overview?.totalOrders ?? 0}
          help="All orders currently stored in MongoDB."
        />
        <MetricCard
          label="Pending payments"
          value={isLoading ? '...' : stats?.overview?.pendingPayments ?? 0}
          help="Orders still waiting for manual payment confirmation."
        />
        <MetricCard
          label="Today revenue"
          value={isLoading ? '...' : formatCurrency(stats?.today?.revenue ?? 0)}
          help="Revenue summary from the dashboard aggregate."
        />
        <MetricCard
          label="Customers"
          value={isLoading ? '...' : stats?.overview?.totalCustomers ?? 0}
          help="Customer accounts currently saved in the users collection."
        />
      </section>

      <section className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
        <SectionHeading
          eyebrow="Live status"
          title="Order flow overview"
          description="These counts come straight from the dashboard stats API and make it easy to spot where operations are stacking up."
        />
        <div className="mt-6 flex flex-wrap gap-3">
          {Object.entries(stats?.ordersByStatus || {}).map(([status, count]) => (
            <div
              key={status}
              className="rounded-full border border-palette-light bg-white px-4 py-2 text-sm font-semibold text-palette-dark"
            >
              {status.replace('_', ' ')}: {count}
            </div>
          ))}
        </div>
      </section>

      <section className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
        <SectionHeading
          eyebrow="Recent"
          title="Latest order activity"
          description="This table uses GET /api/admin/orders, which means it mirrors exactly what the admin panel will see after a customer places a new order."
        />
        <div className="mt-6 overflow-x-auto">
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
                  <td className="py-4">
                    <Link href={`/admin/orders/${order._id}`} className="font-semibold text-palette-primary hover:text-palette-dark">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="py-4">
                    <p>{order.customer?.name || order.customer?.email || 'Customer'}</p>
                    <p className="text-palette-dark/60">{order.customer?.phone}</p>
                  </td>
                  <td className="py-4">
                    <StatusPill>{order.status}</StatusPill>
                  </td>
                  <td className="py-4">
                    <StatusPill tone={order.payment?.status === 'paid' ? 'success' : 'soft'}>
                      {order.payment?.status || 'pending'}
                    </StatusPill>
                  </td>
                  <td className="py-4 font-semibold">{formatCurrency(order.pricing?.total || 0)}</td>
                  <td className="py-4 text-palette-dark/70">{formatDateTime(order.createdAt)}</td>
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
