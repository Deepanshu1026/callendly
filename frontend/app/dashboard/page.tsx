'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { format, parseISO } from 'date-fns';

interface Booking {
  id: string;
  guestName: string;
  guestEmail: string;
  startTime: string;
  endTime: string;
  status: string;
  location: string | null;
  eventType: { title: string; duration: number; color: string };
}

interface EventType {
  id: string;
  title: string;
  slug: string;
  duration: number;
  isActive: boolean;
  color: string;
}

interface UserProfile {
  username: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const [meRes, bookingsRes, eventsRes] = await Promise.all([
          api.get('/auth/me'),
          api.get('/bookings?upcoming=true'),
          api.get('/event-types')
        ]);
        setUser(meRes.data.user);
        setBookings(bookingsRes.data.bookings);
        setEventTypes(eventsRes.data.eventTypes);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const loadBookings = async (tab: 'upcoming' | 'past') => {
    try {
      const res = await api.get(`/bookings?${tab === 'upcoming' ? 'upcoming=true' : 'past=true'}`);
      setBookings(res.data.bookings);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async (id: string) => {
    const reason = window.prompt('Cancellation reason (optional):');
    try {
      await api.put(`/bookings/${id}/cancel`, { reason });
      loadBookings(activeTab);
    } catch (err) {
      alert('Failed to cancel booking');
    }
  };

  const handleReschedule = async (id: string) => {
    const newDate = window.prompt('Enter new start time (ISO format, e.g. 2026-06-25T10:00:00Z):');
    if (!newDate) return;
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;
    const durationMs = new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime();
    const newEnd = new Date(new Date(newDate).getTime() + durationMs).toISOString();
    try {
      await api.put(`/bookings/${id}/reschedule`, { newStartTime: newDate, newEndTime: newEnd });
      loadBookings(activeTab);
    } catch (err) {
      alert('Failed to reschedule booking');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  const profile: UserProfile | undefined = user?.profile;
  const publicLink = profile?.username ? `${typeof window !== 'undefined' ? window.location.origin : ''}/booking/${profile.username}` : '';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Callendly
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            {publicLink && (
              <p className="mt-1 text-sm text-gray-500">
                Public link:{' '}
                <Link href={`/booking/${profile?.username || ''}`} className="text-blue-600 hover:underline">
                  {publicLink}
                </Link>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/calendar"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Calendar View
            </Link>
            <Link
              href="/dashboard/availability"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Availability
            </Link>
            <Link
              href="/dashboard/event-types"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Event Types
            </Link>
            <Link
              href="/dashboard/calendars"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Calendars
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => { setActiveTab('upcoming'); loadBookings('upcoming'); }}
                  className={`px-4 py-3 text-sm font-medium ${activeTab === 'upcoming' ? 'border-b-2 border-black text-black' : 'text-gray-500'}`}
                >
                  Upcoming
                </button>
                <button
                  onClick={() => { setActiveTab('past'); loadBookings('past'); }}
                  className={`px-4 py-3 text-sm font-medium ${activeTab === 'past' ? 'border-b-2 border-black text-black' : 'text-gray-500'}`}
                >
                  Past
                </button>
              </div>

              <div className="divide-y divide-gray-100">
                {bookings.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500">
                    No {activeTab} bookings yet.
                  </div>
                ) : (
                  bookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-1 h-3 w-3 rounded-full"
                          style={{ backgroundColor: booking.eventType.color || '#3b82f6' }}
                        />
                        <div>
                          <p className="font-medium text-gray-900">
                            {booking.eventType.title} with {booking.guestName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {format(parseISO(booking.startTime), 'MMM d, yyyy h:mm a')} - {format(parseISO(booking.endTime), 'h:mm a')}
                          </p>
                          <p className="text-xs text-gray-400">{booking.guestEmail}</p>
                          {booking.location && (
                            <p className="text-xs text-gray-400">Location: {booking.location}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {activeTab === 'upcoming' && booking.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => handleReschedule(booking.id)}
                              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleCancel(booking.id)}
                              className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            booking.status === 'confirmed'
                              ? 'bg-green-50 text-green-700'
                              : booking.status === 'cancelled'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-yellow-50 text-yellow-700'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="font-semibold">Event Types</h3>
              <div className="mt-4 space-y-3">
                {eventTypes.length === 0 ? (
                  <p className="text-sm text-gray-500">No event types yet.</p>
                ) : (
                  eventTypes.map((et) => (
                    <div key={et.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: et.color }} />
                        <span className="text-sm">{et.title}</span>
                      </div>
                      <span className="text-xs text-gray-500">{et.duration} min</span>
                    </div>
                  ))
                )}
              </div>
              <Link
                href="/dashboard/event-types"
                className="mt-4 block text-center text-sm font-medium text-blue-600 hover:underline"
              >
                Manage event types
              </Link>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="font-semibold">Quick Stats</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <div className="text-xl font-bold">{bookings.length}</div>
                  <div className="text-xs text-gray-500">{activeTab} meetings</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <div className="text-xl font-bold">{eventTypes.length}</div>
                  <div className="text-xs text-gray-500">Event types</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
