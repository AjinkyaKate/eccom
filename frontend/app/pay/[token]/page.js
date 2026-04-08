import PaymentBillActions from '@/components/pay/PaymentBillActions';
import { getApiBaseUrl } from '@/lib/api';
import { formatCurrency, formatCurrencyPaise } from '@/lib/format';

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value || Date.now()));

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function getBillData(token) {
  const response = await fetch(`${getApiBaseUrl()}/api/pay/${token}`, { cache: 'no-store' });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.data) {
    return {
      error: payload?.message || 'This bill could not be loaded.',
    };
  }

  return { data: payload.data };
}

function SummaryCard({ label, value, tone = 'default' }) {
  const toneClass =
    tone === 'accent'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className={`rounded-3xl border p-5 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default async function PaymentPage({ params }) {
  const { token } = await params;
  const result = await getBillData(token);

  if (result.error) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Bill Preview</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Unable to open this bill</h1>
          <p className="mt-3 text-slate-600">{result.error}</p>
        </div>
      </div>
    );
  }

  const data = result.data;
  const order = data.order || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const totals = order.pricing || {};
  const isPaid = data.status === 'paid';
  const billUrl = data.canonicalBillUrl || data.previewUrl;
  const amountDue = formatCurrency(data.amountDue || 0);
  const invoiceNumber = order.invoice?.invoiceNumber || order.orderNumber || `PAY-${token.slice(0, 8).toUpperCase()}`;
  const customer = order.customer || {};
  const shipping = order.shippingAddress || {};

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#ecfdf5_100%)] px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 bg-slate-950 px-6 py-5 text-white md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Bill Preview</p>
                <h1 className="mt-2 text-3xl font-bold">{data.businessName || 'Rajmangal Wholesale'}</h1>
                <p className="mt-2 text-sm text-slate-300">
                  Invoice #{invoiceNumber} • {formatDate(order.invoice?.generatedAt || order.createdAt || data.createdAt)}
                </p>
              </div>
              <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold">
                {isPaid ? 'Payment confirmed' : 'Payment pending'}
              </div>
            </div>
          </div>

          <div className="space-y-8 px-6 py-6 md:px-8 md:py-8">
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard label="Total Bill" value={formatCurrencyPaise(data.amount || totals.total || 0)} />
              <SummaryCard label="Paid" value={formatCurrencyPaise(data.amountPaid || 0)} />
              <SummaryCard
                label={isPaid ? 'Status' : 'Balance Due'}
                value={isPaid ? 'Paid in full' : amountDue}
                tone="accent"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
              <div className="space-y-5">
                <div className="rounded-[1.75rem] border border-emerald-100 bg-emerald-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                    {isPaid ? 'Order Confirmed' : 'Secure Payment'}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-950">
                    {isPaid ? 'Your payment is complete and your order is being prepared.' : 'Review your bill before making payment.'}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    This web bill is the main version for viewing, sharing, and printing. Nothing downloads automatically.
                  </p>
                  <div className="mt-5">
                    <PaymentBillActions
                      token={token}
                      billUrl={billUrl}
                      amountDue={amountDue}
                      isPaid={isPaid}
                      paymentUrl={!isPaid ? data.razorpayPaymentLinkUrl : ''}
                      canSimulatePayment={Boolean(data.canSimulatePayment && !data.hasConfiguredRazorpay && !isPaid)}
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.75rem] border border-slate-200">
                  <div className="flex items-center justify-between bg-slate-50 px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Items</p>
                      <p className="mt-1 text-sm text-slate-600">{items.length} line items</p>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{formatCurrency(totals.total || data.amount || 0)}</div>
                  </div>
                  <div className="divide-y divide-slate-100 bg-white">
                    {items.map((item, index) => {
                      const quantity = toNumber(item.quantity);
                      const price = toNumber(item.price);
                      const subtotal = toNumber(item.subtotal);

                      return (
                        <div key={`${item._id || item.name}-${index}`} className="flex items-start justify-between gap-4 px-5 py-4">
                          <div>
                            <p className="text-base font-semibold text-slate-950">{item.name}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {quantity} {item.unit || 'PCS'} x {formatCurrencyPaise(price)}
                              {item.sku ? ` • SKU ${item.sku}` : ''}
                            </p>
                          </div>
                          <p className="text-base font-semibold text-slate-900">{formatCurrencyPaise(subtotal)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <aside className="space-y-5">
                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Bill To</p>
                  <p className="mt-3 text-lg font-bold text-slate-950">{data.customerName || customer.name || 'Customer'}</p>
                  <p className="mt-1 text-sm text-slate-600">{customer.phone || data.businessPhone || ''}</p>
                  {shipping.street ? (
                    <div className="mt-4 text-sm leading-6 text-slate-600">
                      <p>{shipping.name || customer.name}</p>
                      <p>{shipping.street}</p>
                      <p>{[shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(', ')}</p>
                      {shipping.landmark ? <p>Near {shipping.landmark}</p> : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Amount Summary</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatCurrencyPaise(totals.subtotal || data.amount || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span>{formatCurrencyPaise(totals.shippingCharges || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount</span>
                      <span>-{formatCurrencyPaise(totals.discount || 0)}</span>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="flex justify-between text-base font-bold text-slate-950">
                      <span>Total</span>
                      <span>{formatCurrencyPaise(totals.total || data.amount || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                  <p className="font-semibold text-slate-900">Need a hard copy later?</p>
                  <p className="mt-2">Use the Print button from this page whenever you want to print or save a copy.</p>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="hidden print:block">
          <div className="rounded-none border border-slate-300 bg-white p-8 text-slate-950 shadow-none">
            <div className="flex items-start justify-between border-b border-slate-300 pb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Official Bill</p>
                <h2 className="mt-2 text-3xl font-bold">{data.businessName || 'Rajmangal Wholesale'}</h2>
                <p className="mt-2 text-sm text-slate-600">{data.businessAddress || ''}</p>
                <p className="text-sm text-slate-600">{data.businessPhone || ''}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">Invoice #{invoiceNumber}</p>
                <p className="mt-1 text-slate-600">{formatDate(order.invoice?.generatedAt || order.createdAt || data.createdAt)}</p>
              </div>
            </div>

            <div className="grid gap-8 border-b border-slate-300 py-6 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Customer</p>
                <p className="mt-2 font-semibold">{data.customerName || customer.name || 'Customer'}</p>
                <p className="text-sm text-slate-600">{customer.phone || ''}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {[shipping.street, shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(', ')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Payment</p>
                <p className="mt-2 font-semibold">{isPaid ? 'Paid in full' : 'Pending'}</p>
                <p className="text-sm text-slate-600">Amount paid: {formatCurrencyPaise(data.amountPaid || 0)}</p>
              </div>
            </div>

            <table className="mt-6 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-slate-500">
                  <th className="py-3">Item</th>
                  <th className="py-3">Qty</th>
                  <th className="py-3">Rate</th>
                  <th className="py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item._id || item.name}-${index}`} className="border-b border-slate-200">
                    <td className="py-3">
                      <p className="font-medium text-slate-950">{item.name}</p>
                      {item.sku ? <p className="text-xs text-slate-500">SKU {item.sku}</p> : null}
                    </td>
                    <td className="py-3">{toNumber(item.quantity)} {item.unit || 'PCS'}</td>
                    <td className="py-3">{formatCurrencyPaise(item.price || 0)}</td>
                    <td className="py-3 text-right">{formatCurrencyPaise(item.subtotal || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto mt-8 max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span>{formatCurrencyPaise(totals.subtotal || data.amount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Shipping</span>
                <span>{formatCurrencyPaise(totals.shippingCharges || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Discount</span>
                <span>-{formatCurrencyPaise(totals.discount || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-3 text-base font-bold">
                <span>Total</span>
                <span>{formatCurrencyPaise(totals.total || data.amount || 0)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
