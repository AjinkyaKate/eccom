'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SiteHeaderClient from '@/components/SiteHeaderClient';

function SiteFooter() {
  return (
    <footer className="border-t border-palette-light/70 bg-white/80">
      <div className="mx-auto flex max-w-shell flex-col gap-2 px-6 py-6 text-sm text-palette-dark/80 md:flex-row md:items-center md:justify-between">
        <p>Eccom Wholesale</p>
      </div>
    </footer>
  );
}

export default function StoreShell({ children }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteHeaderClient />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
