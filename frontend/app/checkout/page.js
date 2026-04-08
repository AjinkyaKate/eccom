'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SectionHeading from '@/components/SectionHeading';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { CUSTOMER_TOKEN_KEY } from '@/lib/session';

const emptyAddress = {
  name: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
  type: 'home',
};

export default function CheckoutPage() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null); // null = new address
  const [newAddress, setNewAddress] = useState(emptyAddress);
  const [error, setError] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customerToken, setCustomerToken] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);
      if (isMounted) setCustomerToken(token);
      if (!token) { setLoading(false); return; }

      try {
        const response = await apiFetch('/api/orders/checkout/summary', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!isMounted) return;

        const checkout = response?.data?.checkout || null;
        setSummary(checkout);

        const saved = checkout?.savedAddresses || [];
        setSavedAddresses(saved);

        // Pre-select default address if available
        const defaultAddr = saved.find((a) => a.isDefault) || saved[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id || defaultAddr._id);
        }
      } catch (err) {
        if (isMounted) setError(getErrorMessage(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => { isMounted = false; };
  }, []);

  const setField = (field) => (e) =>
    setNewAddress((prev) => ({ ...prev, [field]: e.target.value }));

  const handleCheckout = async (e) => {
    e.preventDefault();
    setIsPlacing(true);
    setError('');

    const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);

    const body =
      selectedAddressId !== null
        ? { paymentMethod: 'ONLINE', shippingAddressId: selectedAddressId }
        : { paymentMethod: 'ONLINE', shippingAddress: newAddress };

    try {
      const response = await apiFetch('/api/orders/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      router.push(response?.data?.payment?.previewUrl || '/cart');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsPlacing(false);
    }
  };

  if (!loading && !customerToken) {
    return (
      <div className="mx-auto max-w-shell px-6 py-12">
        <div className="rounded-[2rem] border border-palette-light bg-white p-8 shadow-panel">
          <SectionHeading
            eyebrow="Checkout"
            title="Login to checkout"
            description="Please login first to place your order."
          />
          <div className="mt-6">
            <Link
              href="/login?redirect=/checkout"
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
        <SectionHeading eyebrow="Checkout" title="Place Your Order" />
        <Link href="/cart" className="text-sm font-semibold text-palette-primary hover:text-palette-dark">
          ← Back to cart
        </Link>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-palette-light bg-white p-6 text-palette-dark/70">
          Loading checkout...
        </div>
      ) : (
        <form onSubmit={handleCheckout}>
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left — address selection */}
            <div className="space-y-4">
              <div className="rounded-[2rem] border border-palette-light/80 bg-white p-6 shadow-panel">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-palette-dark">Delivery address</h2>
                  <Link
                    href="/account/addresses"
                    className="text-xs font-semibold text-palette-primary hover:text-palette-dark"
                  >
                    Manage addresses
                  </Link>
                </div>

                {/* Saved address cards */}
                {savedAddresses.length > 0 && (
                  <div className="space-y-3">
                    {savedAddresses.map((addr) => {
                      const id = addr.id || addr._id;
                      const isSelected = selectedAddressId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSelectedAddressId(id)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            isSelected
                              ? 'border-palette-primary bg-palette-lighter'
                              : 'border-palette-light bg-white hover:border-palette-primary/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-palette-dark">{addr.name}</p>
                              <p className="mt-0.5 text-sm text-palette-dark/70">{addr.phone}</p>
                              <p className="mt-1 text-sm text-palette-dark/80">
                                {addr.street}, {addr.city}, {addr.state} – {addr.pincode}
                              </p>
                              {addr.landmark && (
                                <p className="mt-0.5 text-xs text-palette-dark/55">Near: {addr.landmark}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              {addr.isDefault && (
                                <span className="rounded-full bg-palette-primary px-2 py-0.5 text-xs font-semibold text-white">
                                  Default
                                </span>
                              )}
                              <span
                                className={`mt-1 h-4 w-4 rounded-full border-2 ${
                                  isSelected ? 'border-palette-primary bg-palette-primary' : 'border-palette-light'
                                }`}
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {/* Option: use a different address */}
                    <button
                      type="button"
                      onClick={() => setSelectedAddressId(null)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedAddressId === null
                          ? 'border-palette-primary bg-palette-lighter'
                          : 'border-palette-light bg-white hover:border-palette-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-palette-dark">Use a different address</p>
                        <span
                          className={`h-4 w-4 rounded-full border-2 ${
                            selectedAddressId === null
                              ? 'border-palette-primary bg-palette-primary'
                              : 'border-palette-light'
                          }`}
                        />
                      </div>
                    </button>
                  </div>
                )}

                {/* New address form — shown when "different address" selected or no saved addresses */}
                {(selectedAddressId === null || savedAddresses.length === 0) && (
                  <div className={`space-y-4 ${savedAddresses.length > 0 ? 'mt-5 border-t border-palette-light pt-5' : ''}`}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-palette-dark">Full name *</label>
                        <input
                          required={selectedAddressId === null}
                          value={newAddress.name}
                          onChange={setField('name')}
                          className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-palette-dark">Phone *</label>
                        <input
                          required={selectedAddressId === null}
                          value={newAddress.phone}
                          onChange={setField('phone')}
                          placeholder="+91XXXXXXXXXX"
                          className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm font-semibold text-palette-dark">Street / House no. *</label>
                        <textarea
                          required={selectedAddressId === null}
                          value={newAddress.street}
                          onChange={setField('street')}
                          rows={2}
                          className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-palette-dark">City *</label>
                        <input
                          required={selectedAddressId === null}
                          value={newAddress.city}
                          onChange={setField('city')}
                          className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-palette-dark">State *</label>
                        <input
                          required={selectedAddressId === null}
                          value={newAddress.state}
                          onChange={setField('state')}
                          className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-palette-dark">Pincode *</label>
                        <input
                          required={selectedAddressId === null}
                          value={newAddress.pincode}
                          onChange={setField('pincode')}
                          className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-palette-dark">Landmark</label>
                        <input
                          value={newAddress.landmark}
                          onChange={setField('landmark')}
                          placeholder="Optional"
                          className="w-full rounded-2xl border border-palette-light bg-white px-4 py-3 text-base text-palette-dark outline-none transition focus:border-palette-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isPlacing || !summary?.canCheckout}
                className="w-full rounded-full bg-palette-primary px-6 py-4 text-sm font-semibold text-white transition hover:bg-palette-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPlacing ? 'Redirecting to payment...' : 'Proceed to online payment'}
              </button>
            </div>

            {/* Right — order summary */}
            <section className="rounded-[2rem] border border-palette-light/80 bg-white p-8 shadow-panel">
              <h2 className="text-2xl font-semibold text-palette-dark">Order summary</h2>
              <div className="mt-5 space-y-4">
                {summary?.items?.map((item) => (
                  <div key={item.cartItemId} className="rounded-2xl border border-palette-light bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold text-palette-dark">{item.name}</p>
                      <p className="text-palette-dark/70 whitespace-nowrap">Qty {item.quantity}</p>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-palette-primary">
                      {formatCurrency(item.subtotal || 0)}
                    </p>
                    <p className="mt-1 text-xs text-palette-dark/60">
                      {formatCurrency(item.unitPrice || 0)} each
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-palette-light bg-palette-lighter p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-palette-primary/70">Payment Mode</p>
                <p className="mt-2 text-2xl font-bold text-palette-dark">Online Payment</p>
                <p className="mt-2 text-xs text-palette-dark/60 font-medium">You will review the invoice and complete payment on the next screen.</p>
              </div>
              {summary?.issues?.length ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  {summary.issues.map((issue) => issue.message).join(', ')}
                </div>
              ) : null}
            </section>
          </div>
        </form>
      )}
    </div>
  );
}
