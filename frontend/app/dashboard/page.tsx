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
  guestPhone?: string;
  guestNotes?: string;
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

  // AI Prep Notes State
  const [selectedBookingForAI, setSelectedBookingForAI] = useState<Booking | null>(null);
  const [aiPrepLoading, setAiPrepLoading] = useState(false);
  const [aiPrepResult, setAiPrepResult] = useState<{ summary: string; questions: string[] } | null>(null);

  // AI Assistant Widget State
  const [aiRequestText, setAiRequestText] = useState('');
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggestResult, setAiSuggestResult] = useState<{ day: string; timeRange: string; purpose: string; suggestedResponse: string } | null>(null);

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

  const fetchAiPrep = async (booking: Booking) => {
    setSelectedBookingForAI(booking);
    setAiPrepLoading(true);
    setAiPrepResult(null);
    try {
      const res = await api.post('/ai/summarize-meeting', {
        guestName: booking.guestName,
        guestNotes: booking.guestNotes || booking.guestEmail,
        eventTitle: booking.eventType.title
      });
      setAiPrepResult(res.data);
    } catch {
      alert('Failed to generate AI prep notes.');
    } finally {
      setAiPrepLoading(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!aiRequestText.trim()) return;
    setAiSuggestLoading(true);
    setAiSuggestResult(null);
    try {
      const res = await api.post('/ai/suggest-slots', {
        requestText: aiRequestText
      });
      setAiSuggestResult(res.data);
    } catch {
      alert('Failed to parse request with AI.');
    } finally {
      setAiSuggestLoading(false);
    }
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
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/calendar"
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Calendar View
            </Link>
            <Link
              href="/dashboard/availability"
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Availability
            </Link>
            <Link
              href="/dashboard/event-types"
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Event Types
            </Link>
            <Link
              href="/dashboard/teams"
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Teams
            </Link>
            <Link
              href="/dashboard/integrations"
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Integrations
            </Link>
            <Link
              href="/dashboard/analytics"
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Analytics
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
                              onClick={() => fetchAiPrep(booking)}
                              className="rounded-md bg-purple-50 border border-purple-200 px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-100 flex items-center gap-1"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              Prep Notes
                            </button>
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
            {/* AI Scheduling Assistant */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded flex items-center justify-center text-white">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">AI Scheduling Assistant</h3>
              </div>
              <p className="text-xs text-gray-500">Paste a client request message to extract details and generate a reply template.</p>
              
              <textarea
                value={aiRequestText}
                onChange={e => setAiRequestText(e.target.value)}
                placeholder="e.g. Hi Deepanshu, can we meet this Friday morning to discuss the contract?"
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-black focus:outline-none"
              />
              
              <button
                onClick={handleAiSuggest}
                disabled={aiSuggestLoading || !aiRequestText.trim()}
                className="w-full rounded-md bg-black py-2 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {aiSuggestLoading ? 'Parsing with Sarvam AI...' : 'Generate Suggestion'}
              </button>

              {aiSuggestResult && (
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-100 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-gray-700">
                    <div>
                      <span className="font-bold block text-[10px] text-gray-400 uppercase">Extracted Day</span>
                      {aiSuggestResult.day}
                    </div>
                    <div>
                      <span className="font-bold block text-[10px] text-gray-400 uppercase">Time Range</span>
                      {aiSuggestResult.timeRange}
                    </div>
                  </div>
                  <div>
                    <span className="font-bold block text-[10px] text-gray-400 uppercase">Purpose</span>
                    {aiSuggestResult.purpose}
                  </div>
                  <div className="pt-2 border-t border-purple-100">
                    <span className="font-bold block text-[10px] text-gray-400 uppercase mb-1">Suggested Reply</span>
                    <textarea
                      readOnly
                      value={aiSuggestResult.suggestedResponse}
                      onClick={e => (e.target as any).select()}
                      className="w-full rounded border border-purple-200 bg-white p-2 text-gray-600 focus:outline-none"
                      rows={4}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Click reply text to select and copy.</p>
                  </div>
                </div>
              )}
            </div>

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

      {/* AI Prep Notes Drawer/Modal */}
      {selectedBookingForAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black bg-opacity-40">
          <div className="h-full w-full max-w-md bg-white p-6 shadow-2xl overflow-y-auto space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">AI Meeting Prep Notes</h3>
                  <p className="text-xs text-gray-500">For {selectedBookingForAI.eventType.title} with {selectedBookingForAI.guestName}</p>
                </div>
                <button
                  onClick={() => setSelectedBookingForAI(null)}
                  className="rounded-full hover:bg-gray-100 p-2 text-gray-400 hover:text-black"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {aiPrepLoading ? (
                <div className="py-20 text-center space-y-3">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 animate-none" />
                  <p className="text-sm text-gray-500">Consulting Sarvam AI for meeting insights...</p>
                </div>
              ) : aiPrepResult ? (
                <div className="space-y-6">
                  <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 space-y-2">
                    <h4 className="text-xs font-bold text-purple-700 uppercase tracking-wider">AI Summary & Strategy</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">{aiPrepResult.summary}</p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Suggested Questions to Ask</h4>
                    <div className="space-y-2.5">
                      {aiPrepResult.questions.map((q, idx) => (
                        <div key={idx} className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <span className="flex items-center justify-center bg-purple-500 text-white rounded-full h-5 w-5 text-xs font-bold shrink-0 mt-0.5">{idx + 1}</span>
                          <p className="text-sm text-gray-700">{q}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No notes generated.</p>
              )}
            </div>

            <button
              onClick={() => setSelectedBookingForAI(null)}
              className="w-full py-2.5 rounded-lg bg-black text-white text-sm hover:bg-gray-800 mt-6"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
