'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

export default function SiteHeaderClient() {
  const router = useRouter();
  const [customer, setCustomer] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);
      if (!token) return;

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [profileResponse, cartResponse] = await Promise.all([
          apiFetch('/api/auth/me', { headers }),
          apiFetch('/api/cart', { headers }),
        ]);
        if (!isMounted) return;
        setCustomer(profileResponse?.data?.user || null);
        setCartCount(cartResponse?.data?.cart?.totalItems || 0);
      } catch {
        window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
      }
    };

    loadSession();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  const handleLogout = () => {
    window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    setCustomer(null);
    setCartCount(0);
    router.push('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQ.trim();
    if (!q) return;
    setSearchOpen(false);
    setSearchQ('');
    router.push(`/products?search=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-palette-light/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-4 px-6 py-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-palette-primary text-sm font-bold text-white">
            E
          </span>
          <span className="text-base font-semibold tracking-tight text-palette-dark">Eccom Wholesale</span>
        </Link>

        {/* Nav */}
        <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold text-palette-dark">
          <Link href="/products" className="rounded-full px-4 py-2 transition hover:bg-palette-lighter hover:text-palette-primary">
            Products
          </Link>
          <Link href="/cart" className="rounded-full px-4 py-2 transition hover:bg-palette-lighter hover:text-palette-primary">
            Cart{cartCount > 0 ? ` (${cartCount})` : ''}
          </Link>
          <Link href="/orders" className="rounded-full px-4 py-2 transition hover:bg-palette-lighter hover:text-palette-primary">
            My Orders
          </Link>

          {/* Search */}
          <div ref={searchRef} className="relative">
            <button
              type="button"
              onClick={() => { setSearchOpen((o) => !o); setTimeout(() => document.getElementById('hdr-search')?.focus(), 40); }}
              className="rounded-full p-2 transition hover:bg-palette-lighter hover:text-palette-primary"
              aria-label="Search"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
            </button>
            {searchOpen && (
              <form onSubmit={handleSearch} className="absolute right-0 top-full mt-2 flex w-72 overflow-hidden rounded-2xl border border-palette-light bg-white shadow-panel">
                <input
                  id="hdr-search"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search products..."
                  className="flex-1 px-4 py-3 text-sm text-palette-dark outline-none"
                />
                <button type="submit" className="px-4 text-palette-primary hover:text-palette-dark">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                  </svg>
                </button>
              </form>
            )}
          </div>

          {/* Auth */}
          {customer ? (
            <>
              <span className="rounded-full border border-palette-light px-4 py-2 text-palette-dark/70">
                {customer.name || customer.phone}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-palette-light px-4 py-2 transition hover:border-red-300 hover:text-red-600"
              >
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="rounded-full bg-palette-primary px-4 py-2 text-white transition hover:bg-palette-dark">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
