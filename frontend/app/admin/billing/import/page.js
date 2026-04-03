'use client';

import Link from 'next/link';
import { useState } from 'react';
import { apiFetch, getErrorMessage } from '@/lib/api';

const EXAMPLE_CSV = `phone,name,businessName,amount,note
+919876543210,Rajesh Sharma,Sharma Traders,15000,Opening balance
+919123456789,Priya Patel,Patel Enterprises,8500,Outstanding as of April 2026`;

export default function BulkImportPage() {
  const [rows, setRows] = useState([{ phone: '', name: '', businessName: '', amount: '', note: '' }]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [csvText, setCsvText] = useState('');
  const [mode, setMode] = useState('manual'); // 'manual' | 'csv'
  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  const token = typeof window !== 'undefined' ? window.localStorage.getItem('adminToken') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const addRow = () =>
    setRows((r) => [...r, { phone: '', name: '', businessName: '', amount: '', note: '' }]);

  const updateRow = (i, field, value) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

  const parseCsv = () => {
    const lines = csvText.trim().split('\n').filter(Boolean);
    if (lines.length < 2) { setError('CSV must have a header row and at least one data row'); return; }
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const parsed = lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ''; });
      return row;
    });
    setRows(parsed);
    setMode('manual');
    setError('');
  };

  const submit = async () => {
    const validRows = rows.filter((r) => r.phone && Number(r.amount) > 0);
    if (validRows.length === 0) { setError('Add at least one row with phone and amount'); return; }

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const res = await apiFetch('/api/admin/billing/import', {
        method: 'POST',
        headers,
        body: JSON.stringify({ customers: validRows }),
      });
      setResults(res.data);

      // Optionally send WhatsApp to successful imports
      if (sendWhatsApp && res.data.success?.length > 0) {
        for (const item of res.data.success) {
          try {
            await apiFetch(`/api/admin/billing/customers/${item.ledgerId}/whatsapp`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ isReminder: false }),
            });
          } catch (_) {}
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-16">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/billing" className="text-gray-400 hover:text-gray-600 text-sm">← Billing</Link>
        <h1 className="text-xl font-bold text-gray-900">Import Outstanding Balances</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Add existing customers who have pending payments. A payment link and WhatsApp message will be sent to each.
      </p>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-6">
        {['manual', 'csv'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              mode === m ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {m === 'manual' ? 'Manual Entry' : 'CSV Paste'}
          </button>
        ))}
      </div>

      {mode === 'csv' ? (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">CSV Format:</p>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{EXAMPLE_CSV}</pre>
          </div>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste your CSV here..."
            rows={8}
            className="w-full border border-gray-300 rounded-xl p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={parseCsv}
            className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium"
          >
            Parse CSV →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500">Customer {i + 1}</p>
                {rows.length > 1 && (
                  <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 text-xs">
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Phone * (+91...)"
                  value={row.phone}
                  onChange={(e) => updateRow(i, 'phone', e.target.value)}
                  className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Amount ₹ *"
                  value={row.amount}
                  onChange={(e) => updateRow(i, 'amount', e.target.value)}
                  className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={row.name}
                  onChange={(e) => updateRow(i, 'name', e.target.value)}
                  className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Business Name"
                  value={row.businessName}
                  onChange={(e) => updateRow(i, 'businessName', e.target.value)}
                  className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={row.note}
                  onChange={(e) => updateRow(i, 'note', e.target.value)}
                  className="col-span-2 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}

          <button
            onClick={addRow}
            className="w-full border border-dashed border-gray-300 text-gray-500 py-3 rounded-2xl text-sm hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            + Add Another Customer
          </button>
        </div>
      )}

      {/* Options */}
      <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={sendWhatsApp}
            onChange={(e) => setSendWhatsApp(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <div>
            <p className="text-sm font-medium text-gray-800">Send WhatsApp payment request after import</p>
            <p className="text-xs text-gray-400">Each customer will receive a WhatsApp message with their payment link</p>
          </div>
        </label>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
      )}

      {results && (
        <div className="mt-4 space-y-3">
          {results.success?.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="font-semibold text-green-800 text-sm mb-2">
                ✅ {results.success.length} imported successfully
              </p>
              {results.success.map((s, i) => (
                <p key={i} className="text-xs text-green-700">{s.phone}</p>
              ))}
            </div>
          )}
          {results.failed?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="font-semibold text-red-800 text-sm mb-2">
                ❌ {results.failed.length} failed
              </p>
              {results.failed.map((f, i) => (
                <p key={i} className="text-xs text-red-700">{f.phone}: {f.reason}</p>
              ))}
            </div>
          )}
          <Link
            href="/admin/billing/customers"
            className="block w-full text-center bg-gray-900 text-white py-3 rounded-xl text-sm font-medium"
          >
            View All Customers →
          </Link>
        </div>
      )}

      {mode === 'manual' && !results && (
        <button
          onClick={submit}
          disabled={loading}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-4 rounded-2xl text-sm font-semibold transition-colors"
        >
          {loading ? 'Importing...' : `Import ${rows.filter((r) => r.phone && r.amount).length} Customer(s)`}
        </button>
      )}
    </div>
  );
}
