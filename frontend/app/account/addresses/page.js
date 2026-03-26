'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SectionHeading from '@/components/SectionHeading';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

const emptyForm = {
  type: 'home',
  name: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
};

function AddressForm({ initial = emptyForm, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const [makeDefault, setMakeDefault] = useState(false);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, isDefault: makeDefault });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-palette-dark">Full name *</label>
          <input
            required
            value={form.name}
            onChange={set('name')}
            placeholder="Recipient name"
            className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-palette-dark">Phone *</label>
          <input
            required
            value={form.phone}
            onChange={set('phone')}
            placeholder="+91XXXXXXXXXX"
            className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-semibold text-palette-dark">Street / House no. *</label>
          <textarea
            required
            value={form.street}
            onChange={set('street')}
            placeholder="Building, street, area"
            rows={2}
            className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-palette-dark">City *</label>
          <input
            required
            value={form.city}
            onChange={set('city')}
            className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-palette-dark">State *</label>
          <input
            required
            value={form.state}
            onChange={set('state')}
            className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-palette-dark">Pincode *</label>
          <input
            required
            value={form.pincode}
            onChange={set('pincode')}
            className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-palette-dark">Landmark</label>
          <input
            value={form.landmark}
            onChange={set('landmark')}
            placeholder="Optional"
            className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-palette-dark">Address type</label>
          <select
            value={form.type}
            onChange={set('type')}
            className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
          >
            <option value="home">Home</option>
            <option value="office">Office</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <input
            id="makeDefault"
            type="checkbox"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <label htmlFor="makeDefault" className="text-sm text-palette-dark">
            Set as default address
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-palette-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-palette-dark disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save address'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-palette-light px-6 py-3 text-sm font-semibold text-palette-dark transition hover:bg-palette-lighter"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddressCard({ address, onDelete, onSetDefault, deleting, settingDefault }) {
  return (
    <div
      className={`relative rounded-2xl border bg-white p-5 transition ${
        address.isDefault ? 'border-palette-primary' : 'border-palette-light'
      }`}
    >
      {address.isDefault && (
        <span className="absolute right-4 top-4 rounded-full bg-palette-primary px-3 py-1 text-xs font-semibold text-white">
          Default
        </span>
      )}
      <p className="font-semibold text-palette-dark">{address.name}</p>
      <p className="mt-1 text-sm text-palette-dark/70">{address.phone}</p>
      <p className="mt-2 text-sm text-palette-dark/80">
        {address.street}, {address.city}, {address.state} – {address.pincode}
      </p>
      {address.landmark && <p className="mt-1 text-sm text-palette-dark/60">Near: {address.landmark}</p>}
      <p className="mt-1 text-xs capitalize text-palette-dark/50">{address.type}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        {!address.isDefault && (
          <button
            onClick={() => onSetDefault(address.id)}
            disabled={settingDefault}
            className="rounded-full border border-palette-primary px-4 py-1.5 text-xs font-semibold text-palette-primary transition hover:bg-palette-lighter disabled:opacity-60"
          >
            Set as default
          </button>
        )}
        <button
          onClick={() => onDelete(address.id)}
          disabled={deleting}
          className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function AddressesPage() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [customerToken, setCustomerToken] = useState(null);

  const getToken = () => window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const token = getToken();
      if (isMounted) setCustomerToken(token);
      if (!token) { setLoading(false); return; }

      try {
        const res = await apiFetch('/api/addresses', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isMounted) setAddresses(res?.data || []);
      } catch (err) {
        if (isMounted) setError(getErrorMessage(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => { isMounted = false; };
  }, []);

  const handleAdd = async (formData) => {
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch('/api/addresses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(formData),
      });
      const newAddr = res?.data;
      setAddresses((prev) => {
        const updated = formData.isDefault
          ? prev.map((a) => ({ ...a, isDefault: false }))
          : [...prev];
        return [...updated, newAddr];
      });
      setShowForm(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setActionId(id);
    setError('');
    try {
      await apiFetch(`/api/addresses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setAddresses((prev) => {
        const remaining = prev.filter((a) => a.id !== id);
        const deletedWasDefault = prev.find((a) => a.id === id)?.isDefault;
        if (deletedWasDefault && remaining.length > 0) {
          remaining[0] = { ...remaining[0], isDefault: true };
        }
        return remaining;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionId(null);
    }
  };

  const handleSetDefault = async (id) => {
    setActionId(id);
    setError('');
    try {
      await apiFetch(`/api/addresses/${id}/default`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === id }))
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionId(null);
    }
  };

  if (!loading && !customerToken) {
    return (
      <div className="mx-auto max-w-shell px-6 py-12">
        <div className="rounded-[2rem] border border-palette-light bg-white p-8 shadow-panel">
          <SectionHeading eyebrow="Account" title="Login to manage addresses" />
          <div className="mt-6">
            <Link
              href="/login?redirect=/account/addresses"
              className="rounded-full bg-palette-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-palette-dark"
            >
              Login with OTP
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-shell space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeading eyebrow="Account" title="My Addresses" />
        <Link href="/orders" className="text-sm font-semibold text-palette-primary hover:text-palette-dark">
          ← My orders
        </Link>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-palette-dark/70">Loading addresses...</p>
      ) : (
        <div className="space-y-6">
          {addresses.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {addresses.map((addr) => (
                <AddressCard
                  key={addr.id}
                  address={addr}
                  onDelete={handleDelete}
                  onSetDefault={handleSetDefault}
                  deleting={actionId === addr.id}
                  settingDefault={actionId === addr.id}
                />
              ))}
            </div>
          )}

          {showForm ? (
            <div className="rounded-[2rem] border border-palette-light bg-white p-6 shadow-panel">
              <h2 className="mb-5 text-lg font-semibold text-palette-dark">Add new address</h2>
              <AddressForm onSave={handleAdd} onCancel={() => setShowForm(false)} saving={saving} />
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-full bg-palette-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-palette-dark"
            >
              + Add new address
            </button>
          )}
        </div>
      )}
    </div>
  );
}
