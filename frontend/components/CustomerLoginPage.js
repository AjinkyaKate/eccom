'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

export default function CustomerLoginPage({ redirectTo = '/cart' }) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('request');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem(CUSTOMER_TOKEN_KEY)) {
      router.replace(redirectTo);
    }
  }, [redirectTo, router]);

  const handleSendOtp = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });

      setStep('verify');
      if (response?.data?.debugOtp) {
        setOtp(response.data.debugOtp);
        setMessage(`Mock OTP (local testing): ${response.data.debugOtp}`);
      } else {
        setMessage(response?.message || 'OTP sent to your WhatsApp.');
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
      });

      const token = response.data.token;
      window.localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
      window.dispatchEvent(new CustomEvent('auth:updated'));

      const pendingRaw = sessionStorage.getItem('pendingCartAdd');
      let destination = redirectTo;

      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          sessionStorage.removeItem('pendingCartAdd');
          await apiFetch('/api/cart/add', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ productId: pending.productId, quantity: pending.quantity }),
          });
          window.dispatchEvent(new CustomEvent('cart:updated'));
          if (redirectTo.startsWith('/products/')) {
            destination = `${redirectTo}?cartAdded=1`;
          }
        } catch {}
      }

      router.push(destination);
    } catch (verifyError) {
      setError(getErrorMessage(verifyError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo.jpeg" alt="Logo" className="mx-auto mb-4 h-16 w-16 rounded-full object-contain" />
          <h1 className="text-2xl font-semibold text-palette-dark">Welcome back</h1>
          <p className="mt-1 text-sm text-palette-dark/60">Login with your WhatsApp number</p>
        </div>

        <div className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
          <form className="space-y-5" onSubmit={step === 'request' ? handleSendOtp : handleVerifyOtp}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-palette-dark" htmlFor="phone">
                WhatsApp Number
              </label>
              <div className="flex items-center gap-2">
                <span className="rounded-2xl border border-palette-light bg-gray-50 px-4 py-3 text-base text-palette-dark/60 select-none">
                  +91
                </span>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="9876543210"
                  maxLength={10}
                  disabled={step === 'verify'}
                  className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary disabled:bg-gray-50 disabled:text-palette-dark/60"
                />
              </div>
            </div>

            {step === 'verify' && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-palette-dark" htmlFor="otp">
                  Enter OTP sent to your WhatsApp
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  placeholder="Enter OTP"
                  maxLength={6}
                  className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
                />
                <button
                  type="button"
                  onClick={() => { setStep('request'); setOtp(''); setMessage(''); setError(''); }}
                  className="mt-2 text-xs text-palette-primary underline"
                >
                  Change number
                </button>
              </div>
            )}

            {message && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-palette-primary py-3 text-sm font-semibold text-white transition hover:bg-palette-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Please wait...' : step === 'request' ? 'Send OTP on WhatsApp' : 'Verify & Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
