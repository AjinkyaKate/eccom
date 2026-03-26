'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

export default function HeroCta() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!window.localStorage.getItem(CUSTOMER_TOKEN_KEY));
    const handler = () => setLoggedIn(!!window.localStorage.getItem(CUSTOMER_TOKEN_KEY));
    window.addEventListener('auth:updated', handler);
    return () => window.removeEventListener('auth:updated', handler);
  }, []);

  if (loggedIn) {
    return (
      <Link
        href="/orders"
        className="rounded-full border border-palette-light px-6 py-3 text-sm font-semibold text-palette-dark transition hover:bg-palette-lighter"
      >
        My Orders
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      className="rounded-full border border-palette-light px-6 py-3 text-sm font-semibold text-palette-dark transition hover:bg-palette-lighter"
    >
      Login / Sign up
    </Link>
  );
}
