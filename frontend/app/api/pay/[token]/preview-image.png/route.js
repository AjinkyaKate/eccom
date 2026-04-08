import { ImageResponse } from 'next/og';
import { getApiBaseUrl } from '@/lib/api';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const formatMoney = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

async function getBillData(token) {
  const response = await fetch(`${getApiBaseUrl()}/api/pay/${token}`, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error('Bill not found');
  }

  const payload = await response.json();
  return payload?.data;
}

export async function GET(_request, context) {
  try {
    const { token } = await context.params;
    const data = await getBillData(token);
    const order = data.order || {};
    const invoiceNumber = order.invoice?.invoiceNumber || order.orderNumber || `PAY-${token.slice(0, 8).toUpperCase()}`;
    const itemCount = Array.isArray(order.items) ? order.items.length : 0;

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            background: 'linear-gradient(135deg, #f8fafc 0%, #dcfce7 100%)',
            color: '#0f172a',
            fontFamily: 'sans-serif',
            padding: '44px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              width: '100%',
              borderRadius: '32px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
              padding: '40px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', color: '#0f766e' }}>
                  Paid Bill Preview
                </div>
                <div style={{ fontSize: 52, fontWeight: 800 }}>{data.businessName || 'Rajmangal Wholesale'}</div>
                <div style={{ fontSize: 28, color: '#334155' }}>
                  {data.customerName || order.customer?.name || 'Customer'}
                </div>
              </div>
              <div
                style={{
                  padding: '14px 22px',
                  borderRadius: '999px',
                  background: data.status === 'paid' ? '#dcfce7' : '#fef3c7',
                  color: data.status === 'paid' ? '#166534' : '#92400e',
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {data.status === 'paid' ? 'Payment Confirmed' : 'Awaiting Payment'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
              {[
                ['Invoice', invoiceNumber],
                ['Amount', formatMoney(data.amountPaid || data.amount)],
                ['Items', `${itemCount} line items`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    borderRadius: '24px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                  }}
                >
                  <div style={{ fontSize: 20, textTransform: 'uppercase', letterSpacing: 3, color: '#64748b' }}>{label}</div>
                  <div style={{ fontSize: 34, fontWeight: 800 }}>{value}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '24px',
                fontSize: 22,
                color: '#475569',
              }}
            >
              <div>Your order is being prepared. View the full bill online for printing or sharing.</div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>View Bill Online</div>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (_) {
    return new Response('Bill preview unavailable', { status: 404 });
  }
}
