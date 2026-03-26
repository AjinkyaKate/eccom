'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SectionHeading from '@/components/SectionHeading';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

export default function CustomerLoginPage({ redirectTo = '/cart' }) {
  const router = useRouter();
  const [phone, setPhone] = useState('+919999999999');
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
        setMessage(`Mock OTP ready for local testing: ${response.data.debugOtp}`);
      } else {
        setMessage(response?.message || 'OTP sent.');
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

      // Tell header to immediately refresh customer + cart state
      window.dispatchEvent(new CustomEvent('auth:updated'));

      // If user was trying to add a product before being asked to login,
      // add it to cart now so they don't lose their action
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
          // If redirectTo is a product page, add ?cartAdded=1 so the panel shows "Added!" banner
          if (redirectTo.startsWith('/products/')) {
            destination = `${redirectTo}?cartAdded=1`;
          }
        } catch {
          // Cart add failed — still redirect, user can retry
        }
      }

      router.push(destination);
    } catch (verifyError) {
      setError(getErrorMessage(verifyError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-shell px-6 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
          <SectionHeading
            eyebrow="Customer access"
            title="Login with WhatsApp OTP"
            description="This screen is wired to the OTP APIs. In local mock mode, the generated OTP is shown here so cart, checkout, and order pages can be tested end to end."
          />
          <div className="mt-8 rounded-2xl border border-palette-light bg-white p-5 text-sm leading-7 text-palette-dark/75">
            <p className="font-semibold text-palette-dark">Flow</p>
            <p>1. Send OTP to the phone number.</p>
            <p>2. Enter the OTP you receive on WhatsApp.</p>
            <p>3. After verification, the customer token is reused across the storefront.</p>
          </div>
        </section>

        <section className="panel-surface rounded-[2rem] border border-palette-light/80 p-8 shadow-panel">
          <form className="space-y-5" onSubmit={step === 'request' ? handleSendOtp : handleVerifyOtp}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-palette-dark" htmlFor="phone">
                WhatsApp phone number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
              />
            </div>

            {step === 'verify' ? (
              <div>
                <label className="mb-2 block text-sm font-semibold text-palette-dark" htmlFor="otp">
                  OTP
                </label>
                <input
                  id="otp"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
                />
              </div>
            ) : null}

            {message ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex rounded-full bg-palette-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-palette-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Please wait...' : step === 'request' ? 'Send OTP' : 'Verify and continue'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
