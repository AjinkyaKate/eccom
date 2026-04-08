'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getErrorMessage } from '@/lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const UNIT_OPTIONS = ['PCS', 'KG', 'GMS', 'LTR', 'MTR', 'BOX', 'SET', 'NOS', 'PAIR', 'DOZ'];
const EMPTY_ITEM = {
  product: '', name: '', sku: '', hsn: '', unit: 'PCS',
  price: '', quantity: 1, cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const recalcItem = (item) => {
  const taxable   = Number(item.price || 0) * Number(item.quantity || 0);
  const cgstAmount = +(taxable * (Number(item.cgstRate || 0) / 100)).toFixed(2);
  const sgstAmount = +(taxable * (Number(item.sgstRate || 0) / 100)).toFixed(2);
  return { ...item, cgstAmount, sgstAmount };
};

// ── Sub-components ────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-colors ${
        active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inp = 'w-full border border-gray-300 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

function ProductSearchRow({ item, idx, onChange, onRemove, defaultCgst, defaultSgst }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounce = useRef(null);

  const doSearch = (q) => {
    if (!q.trim()) { setResults([]); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`/api/products/search?q=${encodeURIComponent(q)}&limit=8`);
        setResults(res?.data?.products || []);
      } catch (_) {}
      finally { setSearching(false); }
    }, 300);
  };

  const selectProduct = (p) => {
    const price = p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price;
    const updated = recalcItem({
      ...EMPTY_ITEM,
      product: p._id,
      name: p.name,
      sku: p.sku || '',
      hsn: p.hsn || '',
      unit: p.unit || 'PCS',
      price,
      quantity: item.quantity || 1,
      cgstRate: defaultCgst || 0,
      sgstRate: defaultSgst || 0,
    });
    onChange(idx, updated);
    setSearch(p.name);
    setShowDropdown(false);
    setResults([]);
  };

  const updateField = (field) => (e) => {
    const val = ['price', 'quantity', 'cgstRate', 'sgstRate'].includes(field)
      ? Number(e.target.value) : e.target.value;
    onChange(idx, recalcItem({ ...item, [field]: val }));
  };

  const taxable  = Number(item.price || 0) * Number(item.quantity || 0);
  const rowTotal = taxable + Number(item.cgstAmount || 0) + Number(item.sgstAmount || 0);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Item {idx + 1}</span>
        {idx > 0 && (
          <button type="button" onClick={() => onRemove(idx)}
            className="text-red-400 hover:text-red-600 text-sm font-medium">
            Remove
          </button>
        )}
      </div>

      {/* Product search */}
      <div className="relative">
        <Field label="Search Product or Enter Name" required>
          <input
            type="text"
            value={search || item.name}
            onChange={(e) => {
              setSearch(e.target.value);
              onChange(idx, recalcItem({ ...item, name: e.target.value, product: '' }));
              doSearch(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="Type product name or search catalog..."
            className={inp}
          />
        </Field>

        {showDropdown && (results.length > 0 || searching) && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
            {searching && (
              <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
            )}
            {results.map((p) => {
              const price = p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price;
              return (
                <button
                  key={p._id}
                  type="button"
                  onMouseDown={() => selectProduct(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left border-t border-gray-100 first:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.sku || ''} {p.unit || 'PCS'}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-800 ml-4">₹{fmt(price)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Item details grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <Field label="HSN/SAC">
          <input value={item.hsn} onChange={updateField('hsn')} className={inp} placeholder="e.g. 1006" />
        </Field>

        <Field label="Unit">
          <select value={item.unit} onChange={updateField('unit')} className={inp}>
            {UNIT_OPTIONS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </Field>

        <Field label="Rate (₹)" required>
          <input type="number" min="0" step="0.01" value={item.price}
            onChange={updateField('price')} className={inp} placeholder="0.00" />
        </Field>

        <Field label="Quantity" required>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => updateField('quantity')({ target: { value: Math.max(1, Number(item.quantity) - 1) } })}
              className="w-12 h-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-xl font-bold text-gray-700 flex-shrink-0">
              −
            </button>
            <input type="number" min="1" value={item.quantity}
              onChange={updateField('quantity')}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-3 text-base text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="button"
              onClick={() => updateField('quantity')({ target: { value: Number(item.quantity) + 1 } })}
              className="w-12 h-12 flex items-center justify-center bg-gray-900 hover:bg-gray-800 rounded-xl text-xl font-bold text-white flex-shrink-0">
              +
            </button>
          </div>
        </Field>

        <Field label="CGST %">
          <input type="number" min="0" max="28" step="0.5" value={item.cgstRate}
            onChange={updateField('cgstRate')} className={inp} placeholder="0" />
        </Field>

        <Field label="SGST %">
          <input type="number" min="0" max="28" step="0.5" value={item.sgstRate}
            onChange={updateField('sgstRate')} className={inp} placeholder="0" />
        </Field>
      </div>

      {/* Row totals */}
      <div className="bg-gray-50 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-sm">
        <span className="text-gray-500">Taxable: <strong className="text-gray-900">₹{fmt(taxable)}</strong></span>
        {Number(item.cgstAmount) > 0 && <span className="text-gray-500">CGST: <strong>₹{fmt(item.cgstAmount)}</strong></span>}
        {Number(item.sgstAmount) > 0 && <span className="text-gray-500">SGST: <strong>₹{fmt(item.sgstAmount)}</strong></span>}
        <span className="text-gray-700 font-bold ml-auto">Row Total: ₹{fmt(rowTotal)}</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminNewOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);  // 0=customer, 1=items, 2=address, 3=review
  const [settings, setSettings] = useState(null);

  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [shipping, setShipping] = useState({
    name: '', phone: '', street: '', city: '', state: '', pincode: '', businessName: '',
  });
  const [items, setItems]     = useState([{ ...EMPTY_ITEM }]);
  const [payment, setPayment] = useState({ method: 'COD', status: 'pending' });
  const [orderStatus, setOrderStatus] = useState('confirmed');
  const [notes, setNotes]     = useState('');

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('adminToken') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push('/admin/login'); return; }
    apiFetch('/api/admin/settings', { headers })
      .then((res) => setSettings(res?.data?.settings || null))
      .catch(() => {});
  }, []);

  const syncShipping = (field, val) => {
    setCustomer((p) => ({ ...p, [field]: val }));
    if (field === 'name'  && !shipping.name)  setShipping((p) => ({ ...p, name: val }));
    if (field === 'phone' && !shipping.phone) setShipping((p) => ({ ...p, phone: val }));
  };

  const updateItem  = useCallback((idx, updated) => setItems((p) => p.map((it, i) => i === idx ? updated : it)), []);
  const addItem     = () => setItems((p) => [...p, { ...EMPTY_ITEM }]);
  const removeItem  = (idx) => setItems((p) => p.filter((_, i) => i !== idx));

  const totals = items.reduce((acc, it) => {
    const taxable = Number(it.price || 0) * Number(it.quantity || 0);
    acc.subtotal += taxable;
    acc.cgst     += Number(it.cgstAmount || 0);
    acc.sgst     += Number(it.sgstAmount || 0);
    acc.total    += taxable + Number(it.cgstAmount || 0) + Number(it.sgstAmount || 0);
    return acc;
  }, { subtotal: 0, cgst: 0, sgst: 0, total: 0 });

  const canProceed = [
    customer.phone.length >= 8,                                    // step 0
    items.every((it) => it.name && Number(it.price) > 0),          // step 1
    shipping.street && shipping.city && shipping.state && shipping.pincode, // step 2
  ];

  const handleSubmit = async () => {
    setError('');
    setSaving(true);
    try {
      const body = {
        customer: { name: customer.name, phone: customer.phone, email: customer.email || undefined },
        shippingAddress: {
          name:         shipping.name  || customer.name,
          phone:        shipping.phone || customer.phone,
          street:       shipping.street,
          city:         shipping.city,
          state:        shipping.state,
          pincode:      shipping.pincode,
          businessName: shipping.businessName || undefined,
        },
        items: items
          .filter((it) => it.name && Number(it.price) > 0)
          .map((it) => ({
            product:    it.product || undefined,
            name:       it.name,
            sku:        it.sku    || undefined,
            hsn:        it.hsn    || undefined,
            unit:       it.unit,
            price:      Number(it.price),
            quantity:   Number(it.quantity),
            cgstRate:   Number(it.cgstRate  || 0),
            cgstAmount: Number(it.cgstAmount || 0),
            sgstRate:   Number(it.sgstRate  || 0),
            sgstAmount: Number(it.sgstAmount || 0),
          })),
        payment: { method: payment.method, status: payment.status },
        status:  orderStatus,
        notes:   notes || undefined,
      };

      const res = await apiFetch('/api/admin/orders/create', {
        method: 'POST', headers,
        body: JSON.stringify(body),
      });

      const orderId = res?.data?.order?._id;
      router.push(orderId ? `/admin/orders/${orderId}` : '/admin/orders');
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  const STEPS = ['Customer', 'Items', 'Address', 'Review'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.back()}
              className="text-gray-400 hover:text-gray-700 text-sm font-medium">
              ← Back
            </button>
            <h1 className="text-base font-bold text-gray-900">New Order</h1>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                  i < step ? 'bg-green-500 text-white' :
                  i === step ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{i < step ? '✓' : i + 1}</div>
                {i < STEPS.length - 1 && <div className={`w-4 h-0.5 ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-32 space-y-4">

        {/* STEP 0 — Customer */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Who is this for?</h2>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <Field label="WhatsApp Number" required>
                <input
                  type="tel"
                  value={customer.phone}
                  onChange={(e) => syncShipping('phone', e.target.value)}
                  className={inp}
                  placeholder="+91 98765 43210"
                  autoFocus
                />
              </Field>

              <Field label="Customer Name">
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => syncShipping('name', e.target.value)}
                  className={inp}
                  placeholder="Full name"
                />
              </Field>

              <Field label="Business Name">
                <input
                  type="text"
                  value={shipping.businessName}
                  onChange={(e) => setShipping((p) => ({ ...p, businessName: e.target.value }))}
                  className={inp}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={customer.email}
                  onChange={(e) => setCustomer((p) => ({ ...p, email: e.target.value }))}
                  className={inp}
                  placeholder="Optional"
                />
              </Field>
            </div>
          </div>
        )}

        {/* STEP 1 — Items */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Add Items</h2>
              <button type="button" onClick={addItem}
                className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
                + Add Item
              </button>
            </div>

            {items.map((item, idx) => (
              <ProductSearchRow
                key={idx}
                item={item}
                idx={idx}
                onChange={updateItem}
                onRemove={removeItem}
                defaultCgst={settings?.defaultCgstRate || 0}
                defaultSgst={settings?.defaultSgstRate || 0}
              />
            ))}

            {/* Running total */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{fmt(totals.subtotal)}</span></div>
                {totals.cgst > 0 && <div className="flex justify-between"><span>CGST</span><span>₹{fmt(totals.cgst)}</span></div>}
                {totals.sgst > 0 && <div className="flex justify-between"><span>SGST</span><span>₹{fmt(totals.sgst)}</span></div>}
              </div>
              <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between">
                <span className="font-bold text-gray-900">Grand Total</span>
                <span className="text-xl font-bold text-gray-900">₹{fmt(totals.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — Address */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Delivery Address</h2>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Name" required>
                  <input value={shipping.name} onChange={(e) => setShipping((p) => ({ ...p, name: e.target.value }))}
                    className={inp} placeholder="Contact name" />
                </Field>
                <Field label="Phone" required>
                  <input value={shipping.phone} onChange={(e) => setShipping((p) => ({ ...p, phone: e.target.value }))}
                    className={inp} placeholder="+91..." />
                </Field>
              </div>
              <Field label="Street / Address" required>
                <input value={shipping.street} onChange={(e) => setShipping((p) => ({ ...p, street: e.target.value }))}
                  className={inp} placeholder="Plot no, area, street" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="City" required>
                  <input value={shipping.city} onChange={(e) => setShipping((p) => ({ ...p, city: e.target.value }))}
                    className={inp} placeholder="City" />
                </Field>
                <Field label="State" required>
                  <input value={shipping.state} onChange={(e) => setShipping((p) => ({ ...p, state: e.target.value }))}
                    className={inp} placeholder="State" />
                </Field>
                <Field label="Pincode" required>
                  <input value={shipping.pincode} onChange={(e) => setShipping((p) => ({ ...p, pincode: e.target.value }))}
                    className={inp} placeholder="6-digit pincode" />
                </Field>
                <Field label="Landmark">
                  <input value={shipping.landmark || ''} onChange={(e) => setShipping((p) => ({ ...p, landmark: e.target.value }))}
                    className={inp} placeholder="Optional" />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Review & Place Order</h2>

            {/* Customer summary */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Customer</p>
              <p className="font-semibold text-gray-900">{customer.name || '(no name)'}</p>
              <p className="text-sm text-gray-500">{customer.phone}</p>
              {shipping.businessName && <p className="text-sm text-gray-500">{shipping.businessName}</p>}
            </div>

            {/* Items summary */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Items ({items.length})</p>
              </div>
              {items.map((it, i) => {
                const taxable  = Number(it.price || 0) * Number(it.quantity || 0);
                const rowTotal = taxable + Number(it.cgstAmount || 0) + Number(it.sgstAmount || 0);
                return (
                  <div key={i} className="flex justify-between items-center px-5 py-3 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{it.name}</p>
                      <p className="text-xs text-gray-400">{it.quantity} {it.unit} × ₹{fmt(it.price)}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">₹{fmt(rowTotal)}</p>
                  </div>
                );
              })}
              <div className="px-5 py-4 bg-gray-50 border-t">
                <div className="flex justify-between font-bold text-gray-900 text-base">
                  <span>Grand Total</span>
                  <span>₹{fmt(totals.total)}</span>
                </div>
              </div>
            </div>

            {/* Address summary */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Delivery Address</p>
              <p className="text-sm text-gray-700">
                {[shipping.street, shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(', ')}
              </p>
            </div>

            {/* Payment + status */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payment & Status</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Payment Method">
                  <select value={payment.method} onChange={(e) => setPayment((p) => ({ ...p, method: e.target.value }))} className={inp}>
                    <option value="COD">COD</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </Field>
                <Field label="Payment Status">
                  <select value={payment.status} onChange={(e) => setPayment((p) => ({ ...p, status: e.target.value }))} className={inp}>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                </Field>
                <Field label="Order Status">
                  <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} className={inp}>
                    <option value="placed">Placed</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="packed">Packed</option>
                    <option value="dispatched">Dispatched</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </Field>
              </div>
              <Field label="Notes (internal)">
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                  className={inp} placeholder="Optional..." />
              </Field>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">{error}</div>
            )}
          </div>
        )}
      </div>

      {/* Sticky bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 safe-area-pb">
        <div className="max-w-2xl mx-auto flex gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)}
              className="flex-1 border border-gray-300 text-gray-700 py-4 rounded-2xl font-semibold text-base">
              ← Back
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed[step]}
              className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white py-4 rounded-2xl font-semibold text-base transition-colors"
            >
              {step === 0 ? 'Add Items →' : step === 1 ? 'Add Address →' : 'Review Order →'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-4 rounded-2xl font-semibold text-base transition-colors"
            >
              {saving ? 'Placing Order...' : '✓ Place Order'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
