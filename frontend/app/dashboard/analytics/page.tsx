'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Stats {
  totalBookings: number;
  confirmed: number;
  cancelled: number;
  rescheduled: number;
  conversionRate: number;
}

interface TrendItem {
  date: string;
  count: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    api.get('/analytics').then(res => {
      setStats(res.data.stats);
      setTrend(res.data.trend);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="p-8">Loading analytics...</div>;

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

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold">Analytics</h1>

        {stats && (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mb-8">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center">
              <p className="text-sm text-gray-500 uppercase font-medium mb-1">Total Bookings</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalBookings}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center">
              <p className="text-sm text-gray-500 uppercase font-medium mb-1">Confirmed</p>
              <p className="text-3xl font-bold text-green-600">{stats.confirmed}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center">
              <p className="text-sm text-gray-500 uppercase font-medium mb-1">Rescheduled</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.rescheduled}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center">
              <p className="text-sm text-gray-500 uppercase font-medium mb-1">Cancelled</p>
              <p className="text-3xl font-bold text-red-600">{stats.cancelled}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center col-span-2 lg:col-span-1">
              <p className="text-sm text-gray-500 uppercase font-medium mb-1">Conversion Rate</p>
              <p className="text-3xl font-bold text-blue-600">{stats.conversionRate}%</p>
            </div>
          </div>
        )}

        {/* Daily booking trends */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Daily Booking Trends</h2>
          
          {trend.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No scheduling history found to generate trends.</p>
          ) : (
            <div className="space-y-4">
              {trend.map((item, idx) => {
                const maxCount = Math.max(...trend.map(t => t.count));
                const barWidth = maxCount > 0 ? `${(item.count / maxCount) * 100}%` : '0%';
                
                return (
                  <div key={idx} className="flex items-center gap-4">
                    <span className="w-24 text-sm font-medium text-gray-600">{item.date}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div className="bg-black h-full" style={{ width: barWidth }} />
                    </div>
                    <span className="w-8 text-sm font-bold text-right">{item.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
