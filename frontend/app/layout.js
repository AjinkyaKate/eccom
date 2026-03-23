import Link from 'next/link';
import SiteHeaderClient from '@/components/SiteHeaderClient';
import './globals.css';

export const metadata = {
  title: 'Eccom Wholesale',
  description: 'Customer storefront and admin operations UI for the Eccom backend.',
};

function SiteFooter() {
  return (
    <footer className="border-t border-palette-light/70 bg-white/80">
      <div className="mx-auto flex max-w-shell flex-col gap-2 px-6 py-6 text-sm text-palette-dark/80 md:flex-row md:items-center md:justify-between">
        <p>Built on your local Express + MongoDB backend.</p>
        <p>Style direction adapted from the provided Shopify starter.</p>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="grid-pattern min-h-screen">
          <SiteHeaderClient />
          <main>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
