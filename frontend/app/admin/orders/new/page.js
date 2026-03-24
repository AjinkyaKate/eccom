'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SectionHeading from '@/components/SectionHeading';
import { apiFetch, getErrorMessage } from '@/lib/api';

const EMPTY_ITEM = {
  name: '', sku: '', hsn: '', unit: 'PCS', price: '', quantity: 1,
  cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0,
};

const UNIT_OPTIONS = ['PCS', 'KG', 'GMS', 'LTR', 'MTR', 'BOX', 'SET', 'NOS', 'PAIR'];

function ItemRow({ item, idx, onChange, onRemove, settings }) {
  const set = (field) => (e) => {
    const val = ['price', 'quantity', 'cgstRate', 'sgstRate'].includes(field)
      ? Number(e.target.value)
      : e.target.value;
    const updated = { ...item, [field]: val };

    // auto-calc tax amounts
    const taxable = Number(updated.price || 0) * Number(updated.quantity || 0);
    updated.cgstAmount = +(taxable * (Number(updated.cgstRate || 0) / 100)).toFixed(2);
    updated.sgstAmount = +(taxable * (Number(updated.sgstRate || 0) / 100)).toFixed(2);

    onChange(idx, updated);
  };

  const taxable = (Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2);
  const rowTotal = (
    Number(item.price || 0) * Number(item.quantity || 0) +
    Number(item.cgstAmount || 0) +
    Number(item.sgstAmount || 0)
  ).toFixed(2);

  return (
    <div className="relative rounded-2xl border border-palette-light bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-palette-primary/70">Item {idx + 1}</span>
        {idx > 0 && (
          <button type="button" onClick={() => onRemove(idx)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div className="col-span-2 sm:col-span-3 lg:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Item Name *</label>
          <input required value={item.name} onChange={set('name')} className="input-field" placeholder="e.g. Basmati Rice 5kg" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-palette-dark/70">SKU</label>
          <input value={item.sku} onChange={set('sku')} className="input-field" placeholder="e.g. RICE-5KG" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-palette-dark/70">HSN/SAC</label>
          <input value={item.hsn} onChange={set('hsn')} className="input-field" placeholder="e.g. 1006" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Unit</label>
          <select value={item.unit} onChange={set('unit')} className="input-field">
            {UNIT_OPTIONS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Rate (₹) *</label>
          <input required type="number" min="0" step="0.01" value={item.price} onChange={set('price')} className="input-field" placeholder="0.00" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Qty *</label>
          <input required type="number" min="1" value={item.quantity} onChange={set('quantity')} className="input-field" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-palette-dark/70">CGST %</label>
          <input type="number" min="0" max="100" step="0.5" value={item.cgstRate} onChange={set('cgstRate')} className="input-field"
            placeholder={settings?.defaultCgstRate || '0'} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-palette-dark/70">SGST %</label>
          <input type="number" min="0" max="100" step="0.5" value={item.sgstRate} onChange={set('sgstRate')} className="input-field"
            placeholder={settings?.defaultSgstRate || '0'} />
        </div>

        <div className="col-span-2">
          <p className="mt-2 text-xs text-palette-dark/50">
            Taxable: ₹{taxable} &nbsp;|&nbsp; CGST: ₹{Number(item.cgstAmount).toFixed(2)} &nbsp;|&nbsp; SGST: ₹{Number(item.sgstAmount).toFixed(2)} &nbsp;|&nbsp;
            <strong>Row Total: ₹{rowTotal}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminNewOrderPage() {
  const router = useRouter();
  const [settings, setSettings] = useState(null);

  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [shipping, setShipping] = useState({ name: '', phone: '', street: '', city: '', state: '', pincode: '', businessName: '' });
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [payment, setPayment] = useState({ method: 'COD', status: 'pending' });
  const [notes, setNotes] = useState('');
  const [orderStatus, setOrderStatus] = useState('placed');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = window.localStorage.getItem('adminToken');
    apiFetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setSettings(res?.data?.settings || null))
      .catch(() => {});
  }, []);

  const setCust = (field) => (e) => setCustomer((p) => ({ ...p, [field]: e.target.value }));
  const setShip = (field) => (e) => setShipping((p) => ({ ...p, [field]: e.target.value }));

  // When customer phone/name changes, auto-fill shipping if empty
  const syncShipping = (field, val) => {
    setCustomer((p) => ({ ...p, [field]: val }));
    if (field === 'phone' && !shipping.phone) setShipping((p) => ({ ...p, phone: val }));
    if (field === 'name' && !shipping.name) setShipping((p) => ({ ...p, name: val }));
  };

  const updateItem = useCallback((idx, updated) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? updated : it)));
  }, []);

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  // Totals
  const totals = items.reduce(
    (acc, it) => {
      const taxable = Number(it.price || 0) * Number(it.quantity || 0);
      acc.subtotal += taxable;
      acc.cgst += Number(it.cgstAmount || 0);
      acc.sgst += Number(it.sgstAmount || 0);
      acc.total += taxable + Number(it.cgstAmount || 0) + Number(it.sgstAmount || 0);
      return acc;
    },
    { subtotal: 0, cgst: 0, sgst: 0, total: 0 }
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const token = window.localStorage.getItem('adminToken');

    try {
      const body = {
        customer: { name: customer.name, phone: customer.phone, email: customer.email },
        shippingAddress: {
          name: shipping.name || customer.name,
          phone: shipping.phone || customer.phone,
          street: shipping.street,
          city: shipping.city,
          state: shipping.state,
          pincode: shipping.pincode,
          businessName: shipping.businessName || undefined,
        },
        items: items.map((it) => ({
          name: it.name,
          sku: it.sku || undefined,
          hsn: it.hsn || undefined,
          unit: it.unit,
          price: Number(it.price),
          quantity: Number(it.quantity),
          cgstRate: Number(it.cgstRate || 0),
          cgstAmount: Number(it.cgstAmount || 0),
          sgstRate: Number(it.sgstRate || 0),
          sgstAmount: Number(it.sgstAmount || 0),
        })),
        payment: { method: payment.method, status: payment.status },
        status: orderStatus,
        notes: notes || undefined,
      };

      const res = await apiFetch('/api/admin/orders/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const orderId = res?.data?.order?._id;
      router.push(orderId ? `/admin/orders/${orderId}` : '/admin/orders');
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeading eyebrow="Orders" title="Create New Order" />
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-palette-light px-5 py-2.5 text-sm font-semibold text-palette-dark hover:bg-palette-lighter"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer */}
        <div className="panel-surface rounded-[2rem] border border-palette-light/80 px-8 py-6 shadow-panel">
          <h3 className="mb-5 text-base font-semibold text-palette-dark">Customer Details</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Name</label>
              <input value={customer.name} onChange={(e) => syncShipping('name', e.target.value)} className="input-field" placeholder="Customer name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Phone *</label>
              <input required value={customer.phone} onChange={(e) => syncShipping('phone', e.target.value)} className="input-field" placeholder="+91..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Email</label>
              <input type="email" value={customer.email} onChange={setCust('email')} className="input-field" placeholder="Optional" />
            </div>
          </div>
        </div>

        {/* Shipping */}
        <div className="panel-surface rounded-[2rem] border border-palette-light/80 px-8 py-6 shadow-panel">
          <h3 className="mb-5 text-base font-semibold text-palette-dark">Delivery Address</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Recipient Name *</label>
              <input required value={shipping.name} onChange={setShip('name')} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Phone *</label>
              <input required value={shipping.phone} onChange={setShip('phone')} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Business Name</label>
              <input value={shipping.businessName} onChange={setShip('businessName')} className="input-field" placeholder="Optional" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Street / Address *</label>
              <input required value={shipping.street} onChange={setShip('street')} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">City *</label>
              <input required value={shipping.city} onChange={setShip('city')} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">State *</label>
              <input required value={shipping.state} onChange={setShip('state')} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Pincode *</label>
              <input required value={shipping.pincode} onChange={setShip('pincode')} className="input-field" />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="panel-surface rounded-[2rem] border border-palette-light/80 px-8 py-6 shadow-panel">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-base font-semibold text-palette-dark">Items</h3>
            <button type="button" onClick={addItem} className="rounded-full border border-palette-primary px-4 py-2 text-xs font-semibold text-palette-primary hover:bg-palette-lighter">
              + Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, idx) => (
              <ItemRow key={idx} item={item} idx={idx} onChange={updateItem} onRemove={removeItem} settings={settings} />
            ))}
          </div>

          {/* Order totals */}
          <div className="mt-6 space-y-1 border-t border-palette-light pt-4 text-right text-sm">
            <div className="text-palette-dark/60">Subtotal: ₹{totals.subtotal.toFixed(2)}</div>
            {totals.cgst > 0 && <div className="text-palette-dark/60">CGST: ₹{totals.cgst.toFixed(2)}</div>}
            {totals.sgst > 0 && <div className="text-palette-dark/60">SGST: ₹{totals.sgst.toFixed(2)}</div>}
            <div className="text-base font-bold text-palette-dark">Grand Total: ₹{totals.total.toFixed(2)}</div>
          </div>
        </div>

        {/* Payment & Status */}
        <div className="panel-surface rounded-[2rem] border border-palette-light/80 px-8 py-6 shadow-panel">
          <h3 className="mb-5 text-base font-semibold text-palette-dark">Payment & Status</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Payment Method</label>
              <select value={payment.method} onChange={(e) => setPayment((p) => ({ ...p, method: e.target.value }))} className="input-field">
                <option value="COD">COD</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Payment Status</label>
              <select value={payment.status} onChange={(e) => setPayment((p) => ({ ...p, status: e.target.value }))} className="input-field">
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-palette-dark/70">Order Status</label>
              <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} className="input-field">
                <option value="placed">Placed</option>
                <option value="confirmed">Confirmed</option>
                <option value="packed">Packed</option>
                <option value="dispatched">Dispatched</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="panel-surface rounded-[2rem] border border-palette-light/80 px-8 py-6 shadow-panel">
          <h3 className="mb-3 text-base font-semibold text-palette-dark">Notes (internal)</h3>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" placeholder="Optional admin notes..." />
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="rounded-full bg-palette-primary px-8 py-3 text-sm font-semibold text-white hover:bg-palette-dark disabled:opacity-60">
            {saving ? 'Creating...' : 'Create Order & Generate Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}
