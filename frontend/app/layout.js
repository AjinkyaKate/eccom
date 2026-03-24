import StoreShell from '@/components/StoreShell';
import './globals.css';

export const metadata = {
  title: 'Eccom Wholesale',
  description: 'Customer storefront and admin operations UI for the Eccom backend.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="grid-pattern min-h-screen">
          <StoreShell>{children}</StoreShell>
        </div>
      </body>
    </html>
  );
}
