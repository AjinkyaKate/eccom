'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getErrorMessage } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem('adminToken')) {
      router.replace('/admin/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const response = await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      window.localStorage.setItem('adminToken', response.data.token);
      router.push('/admin/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel-surface w-full max-w-md rounded-[2rem] border border-palette-light/80 p-10 shadow-panel">
        <div className="mb-8 text-center">
          <img src="/logo.jpeg" alt="Logo" className="mx-auto mb-4 h-16 w-16 rounded-full object-contain" />
          <h1 className="text-2xl font-semibold text-palette-dark">Admin Login</h1>
          <p className="mt-1 text-sm text-palette-dark/60">Sign in to the operations panel</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold text-palette-dark" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-palette-dark" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-palette-primary py-3 text-sm font-semibold text-white transition hover:bg-palette-dark disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
