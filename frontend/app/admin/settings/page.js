'use client';

import { useEffect, useState } from 'react';
import SectionHeading from '@/components/SectionHeading';
import { apiFetch, getErrorMessage } from '@/lib/api';

const FIELD_GROUPS = [
  {
    title: 'Business Info',
    fields: [
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'tagline', label: 'Tagline / Sub-title' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'gstin', label: 'GSTIN' },
      { key: 'pan', label: 'PAN' },
    ],
  },
  {
    title: 'Address',
    fields: [
      { key: 'address', label: 'Street / Flat No.' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'stateCode', label: 'State Code', placeholder: 'e.g. 27' },
      { key: 'pincode', label: 'Pincode' },
    ],
  },
  {
    title: 'Bank Details',
    fields: [
      { key: 'bankAccountName', label: 'Account Holder Name' },
      { key: 'bankAccountNumber', label: 'Account Number' },
      { key: 'bankIfsc', label: 'IFSC Code' },
      { key: 'bankName', label: 'Bank Name' },
      { key: 'bankBranch', label: 'Branch' },
      { key: 'upiId', label: 'UPI ID' },
      { key: 'upiPhone', label: 'UPI Phone' },
    ],
  },
  {
    title: 'Bill / Invoice Customization',
    fields: [
      { key: 'invoicePrefix', label: 'Invoice Number Prefix', placeholder: 'INV' },
      { key: 'defaultCgstRate', label: 'Default CGST %', type: 'number', placeholder: '0' },
      { key: 'defaultSgstRate', label: 'Default SGST %', type: 'number', placeholder: '0' },
      { key: 'logoUrl', label: 'Logo URL (optional)' },
    ],
  },
];

const EMPTY = {
  businessName: '', tagline: '', phone: '', email: '', gstin: '', pan: '',
  address: '', city: '', state: '', stateCode: '', pincode: '',
  bankName: '', bankBranch: '', bankAccountName: '', bankAccountNumber: '', bankIfsc: '',
  upiId: '', upiPhone: '', logoUrl: '',
  invoicePrefix: 'INV', defaultCgstRate: 0, defaultSgstRate: 0,
  termsAndConditions: [],
};

export default function AdminSettingsPage() {
  const [form, setForm] = useState(EMPTY);
  const [termsText, setTermsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const token = window.localStorage.getItem('adminToken');
    apiFetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const s = res?.data?.settings || {};
        setForm({ ...EMPTY, ...s });
        setTermsText((s.termsAndConditions || []).join('\n'));
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const set = (key) => (e) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    const token = window.localStorage.getItem('adminToken');
    const terms = termsText.split('\n').map((t) => t.trim()).filter(Boolean);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, termsAndConditions: terms }),
      });
      setSuccess('Settings saved successfully.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-palette-dark/50">Loading settings...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <SectionHeading eyebrow="Configuration" title="Business Settings" />

      <form onSubmit={handleSubmit} className="space-y-8">
        {FIELD_GROUPS.map((group) => (
          <div key={group.title} className="panel-surface rounded-[2rem] border border-palette-light/80 px-8 py-6 shadow-panel">
            <h3 className="text-base font-semibold text-palette-dark">{group.title}</h3>
            {group.description && (
              <p className="mb-4 mt-1 text-xs text-palette-dark/50">{group.description}</p>
            )}
            {!group.description && <div className="mb-5" />}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {group.fields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-semibold text-palette-dark/70">
                    {f.label}{f.required && ' *'}
                  </label>
                  <input
                    type={f.type || 'text'}
                    value={form[f.key] ?? ''}
                    onChange={set(f.key)}
                    placeholder={f.placeholder || ''}
                    required={f.required}
                    className="input-field"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Terms & Conditions */}
        <div className="panel-surface rounded-[2rem] border border-palette-light/80 px-8 py-6 shadow-panel">
          <h3 className="mb-4 text-base font-semibold text-palette-dark">Terms & Conditions</h3>
          <textarea
            rows={5}
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
            className="input-field"
            placeholder="Goods once sold will not be taken back.&#10;All disputes subject to local jurisdiction."
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-palette-primary px-8 py-3 text-sm font-semibold text-white hover:bg-palette-dark disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
