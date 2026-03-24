import StoreShell from '@/components/StoreShell';
import './globals.css';

export const metadata = {
  title: 'Eccom Wholesale',
  description: 'Customer storefront and admin operations UI for the Eccom backend.',
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
