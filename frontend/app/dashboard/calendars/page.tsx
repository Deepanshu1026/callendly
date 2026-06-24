'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Calendar {
  id: string;
  provider: string;
  name: string;
  isPrimary: boolean;
}

export default function CalendarsPage() {
  const router = useRouter();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    api.get('/calendars').then(res => {
      setCalendars(res.data.calendars);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  const connectGoogle = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('You must be logged in to connect a calendar.');
      return;
    }
    // Redirect to Google OAuth calendar flow, passing JWT token as state
    window.location.href = `/api/auth/google/calendar?state=${token}`;
  };

  const connectOutlook = () => {
    alert('Outlook integration coming in Phase 2.');
  };

  const disconnect = async (id: string) => {
    await api.delete(`/calendars/${id}`);
    setCalendars(calendars.filter(c => c.id !== id));
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold">Callendly</Link>
          <div className="flex gap-2">
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-black">Dashboard</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Connected Calendars</h1>

        <div className="mb-6 flex gap-2">
          <button onClick={connectGoogle} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">Connect Google Calendar</button>
          <button onClick={connectOutlook} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">Connect Outlook</button>
        </div>

        <div className="space-y-3">
          {calendars.length === 0 ? (
            <p className="text-sm text-gray-500">No calendars connected yet.</p>
          ) : (
            calendars.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{c.provider}</p>
                </div>
                <button onClick={() => disconnect(c.id)} className="text-sm text-red-600 hover:underline">Disconnect</button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
