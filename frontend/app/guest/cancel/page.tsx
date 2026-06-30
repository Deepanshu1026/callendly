'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { api } from '@/lib/api';

function GuestCancelForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setLoading(true);
    setError('');
    try {
      await api.put(`/bookings/guest/${token}/cancel`);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel booking');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800">Invalid Link</h1>
          <p className="mt-2 text-gray-500 text-sm">This cancellation link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Cancel Booking</h1>
          <p className="mt-2 text-sm text-gray-500">Are you sure you want to cancel this booking?</p>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        {success ? (
          <div className="mt-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">Your booking has been cancelled successfully.</p>
            <p className="text-xs text-gray-400">A cancellation email has been sent.</p>
          </div>
        ) : (
          <div className="mt-6 flex gap-3">
            <Link
              href="/"
              className="flex-1 rounded-md border border-gray-300 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Go Back
            </Link>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 rounded-md bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GuestCancelPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <GuestCancelForm />
    </Suspense>
  );
}
