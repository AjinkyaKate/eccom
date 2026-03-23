'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

export default function SiteHeaderClient() {
  const [customer, setCustomer] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

      if (!token) {
        if (isMounted) {
          setCustomer(null);
          setCartCount(0);
        }

        return;
      }

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [profileResponse, cartResponse] = await Promise.all([
          apiFetch('/api/auth/me', { headers }),
          apiFetch('/api/cart', { headers }),
        ]);

        if (!isMounted) {
          return;
        }

        setCustomer(profileResponse?.data?.user || null);
        setCartCount(cartResponse?.data?.cart?.totalItems || 0);
      } catch (error) {
        window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        if (isMounted) {
          setCustomer(null);
          setCartCount(0);
        }
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = () => {
    window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    window.location.href = '/';
  };

  return (
    <header className="sticky top-0 z-30 border-b border-palette-light/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-palette-light bg-palette-lighter text-lg font-semibold text-palette-dark">
            E
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight text-palette-dark">Eccom</p>
            <p className="text-sm text-palette-primary/80">Wholesale ordering dashboard</p>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold text-palette-dark">
          <Link
            href="/"
            className="rounded-full border border-palette-light bg-palette-lighter px-4 py-2 transition hover:border-palette-primary hover:text-palette-primary"
          >
            Store
          </Link>
          <Link
            href="/cart"
            className="rounded-full border border-palette-light bg-white px-4 py-2 transition hover:border-palette-primary hover:text-palette-primary"
          >
            Cart {cartCount > 0 ? `(${cartCount})` : ''}
          </Link>
          <Link
            href="/orders"
            className="rounded-full border border-palette-light bg-white px-4 py-2 transition hover:border-palette-primary hover:text-palette-primary"
          >
            My orders
          </Link>
          {customer ? (
            <>
              <span className="rounded-full border border-palette-light bg-white px-4 py-2 text-palette-dark/75">
                {customer.phone}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-palette-primary px-4 py-2 text-palette-primary transition hover:bg-palette-lighter"
              >
                Customer logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-palette-primary px-4 py-2 text-palette-primary transition hover:bg-palette-lighter"
            >
              Customer login
            </Link>
          )}
          <Link
            href="/admin/dashboard"
            className="rounded-full border border-palette-light bg-white px-4 py-2 transition hover:border-palette-primary hover:text-palette-primary"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
