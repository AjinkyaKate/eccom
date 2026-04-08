'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getErrorMessage } from '@/lib/api';

export default function PaymentBillActions({
  token,
  billUrl,
  amountDue,
  isPaid,
  paymentUrl,
  canSimulatePayment,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [shareLabel, setShareLabel] = useState('Share Bill');
  const [error, setError] = useState('');

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Bill Preview',
          text: 'View your bill online',
          url: billUrl,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(billUrl);
        setShareLabel('Link Copied');
        window.setTimeout(() => setShareLabel('Share Bill'), 2000);
      }
    } catch (_) {
      setShareLabel('Share Bill');
    }
  };

  const handleTestPayment = () => {
    setError('');
    startTransition(async () => {
      try {
        await apiFetch(`/api/pay/${token}/test-success`, { method: 'POST' });
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Print
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
        >
          {shareLabel}
        </button>
        {!isPaid && paymentUrl ? (
          <a
            href={paymentUrl}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Pay {amountDue}
          </a>
        ) : null}
        {!isPaid && canSimulatePayment ? (
          <button
            type="button"
            onClick={handleTestPayment}
            disabled={isPending}
            className="rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Processing Test Payment...' : 'Complete Test Payment'}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600 print:hidden">{error}</p> : null}
    </div>
  );
}
