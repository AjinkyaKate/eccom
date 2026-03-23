'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SectionHeading from '@/components/SectionHeading';
import { apiFetch, getApiBaseUrl, getErrorMessage } from '@/lib/api';

const defaultForm = {
  email: 'admin@ecommerce.com',
  password: 'Admin@123',
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem('adminToken')) {
      router.replace('/admin/dashboard');
    }
  }, [router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('adminToken', response.data.token);
      }

      router.push('/admin/dashboard');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-shell px-6 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
          <SectionHeading
            eyebrow="Admin access"
            title="Sign in to the operations panel"
            description="This form hits your real admin login controller and stores the returned token locally for the admin pages."
          />
          <div className="mt-8 space-y-5 text-sm text-palette-dark/75">
            <div className="rounded-2xl border border-palette-light bg-white p-4">
              <p className="font-semibold text-palette-dark">API target</p>
              <p className="mt-2 break-all">{apiBaseUrl}/api/admin/login</p>
            </div>
            <div className="rounded-2xl border border-palette-light bg-white p-4">
              <p className="font-semibold text-palette-dark">Local seed admin</p>
              <p className="mt-2">Email: admin@ecommerce.com</p>
              <p>Password: Admin@123</p>
            </div>
          </div>
        </section>

        <section className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-palette-dark" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-palette-dark" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
              />
            </div>
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex rounded-full bg-palette-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-palette-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in...' : 'Login to admin'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
