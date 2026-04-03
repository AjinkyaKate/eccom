'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/lib/api';

const VARIABLE_HINT = 'Available: {{customerName}} {{businessName}} {{invoiceNumber}} {{orderNumber}} {{amount}} {{amountDue}} {{amountPaid}} {{paymentLink}} {{status}} {{statusNote}}';

export default function WhatsAppTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // template object being edited
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const token = typeof window !== 'undefined' ? window.localStorage.getItem('adminToken') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    setLoading(true);
    apiFetch('/api/admin/billing/templates', { headers })
      .then((res) => setTemplates(res.data.templates || []))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const startEdit = (tmpl) => setEditing({ ...tmpl });
  const startNew = () =>
    setEditing({ key: '', name: '', description: '', body: '', triggerOn: 'manual', isActive: true });

  const save = async () => {
    if (!editing.key || !editing.name || !editing.body) {
      showToast('key, name and body are required');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/admin/billing/templates', {
        method: 'POST',
        headers,
        body: JSON.stringify(editing),
      });
      showToast('Template saved ✓');
      setEditing(null);
      load();
    } catch (err) {
      showToast('Failed: ' + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await apiFetch(`/api/admin/billing/templates/${id}`, { method: 'DELETE', headers });
      showToast('Deleted ✓');
      load();
    } catch (err) {
      showToast('Failed: ' + getErrorMessage(err));
    }
  };

  const triggerLabels = {
    order_placed: 'Auto — Order Placed',
    payment_confirmed: 'Auto — Payment Confirmed',
    manual: 'Manual Only',
    scheduled: 'Scheduled Reminder',
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-16">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm z-50 shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/billing" className="text-gray-400 hover:text-gray-600 text-sm">← Billing</Link>
          <h1 className="text-xl font-bold text-gray-900">WhatsApp Templates</h1>
        </div>
        <button
          onClick={startNew}
          className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
        >
          + New Template
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">{error}</div>
      )}

      {/* Edit / New form */}
      {editing && (
        <div className="bg-white border border-blue-200 rounded-2xl p-5 mb-6 space-y-4">
          <p className="font-semibold text-gray-900">{editing._id ? 'Edit Template' : 'New Template'}</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Key *</label>
              <input
                type="text"
                value={editing.key}
                onChange={(e) => setEditing((v) => ({ ...v, key: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                placeholder="e.g. payment_reminder_2"
                disabled={editing.isSystemTemplate}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Name *</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing((v) => ({ ...v, name: e.target.value }))}
                placeholder="Template display name"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Trigger</label>
            <select
              value={editing.triggerOn}
              onChange={(e) => setEditing((v) => ({ ...v, triggerOn: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {Object.entries(triggerLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Message Body *</label>
            <textarea
              value={editing.body}
              onChange={(e) => setEditing((v) => ({ ...v, body: e.target.value }))}
              rows={8}
              placeholder="Hello {{customerName}},..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">{VARIABLE_HINT}</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.isActive}
                onChange={(e) => setEditing((v) => ({ ...v, isActive: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-gray-900 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-3">
          {templates.map((tmpl) => (
            <div key={tmpl._id} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm">{tmpl.name}</p>
                    {!tmpl.isActive && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                    {tmpl.isSystemTemplate && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">System</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-mono">{tmpl.key}</p>
                  <p className="text-xs text-blue-600 mt-1">{triggerLabels[tmpl.triggerOn]}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(tmpl)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  {!tmpl.isSystemTemplate && (
                    <button
                      onClick={() => deleteTemplate(tmpl._id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 rounded-xl p-3 max-h-32 overflow-y-auto">
                {tmpl.body}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
