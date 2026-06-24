'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import { ArrowRight, Clock, Sparkles } from 'lucide-react';

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
        
        const fetchedUser = meRes.data.user;
        const profile = fetchedUser?.profile;
        
        let needsOnboarding = true;
        if (profile && profile.bio) {
          try {
            const parsedBio = JSON.parse(profile.bio);
            if (parsedBio && parsedBio.onboarded) {
              needsOnboarding = false;
            }
          } catch (e) {
            needsOnboarding = false;
          }
        }
        
        if (needsOnboarding) {
          router.push('/onboarding');
          return;
        }

        setUser(fetchedUser);
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
    <div className="min-h-screen bg-[#fafbfe] text-gray-900 selection:bg-[#006bff]/10">
      {/* Decorative top background gradient */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#006bff]/5 to-transparent pointer-events-none" />

      {/* Premium Floating Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#006bff] text-white shadow-md shadow-[#006bff]/20">
              <span className="text-base font-black">C</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">
              Callendly<span className="text-[#006bff]">.</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-xs font-bold text-gray-900">{user?.name}</span>
              <span className="text-[10px] text-gray-400 font-medium">{user?.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all shadow-sm"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-6 py-10 space-y-10">
        
        {/* Dashboard Title & Quick Links */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-gray-100 pb-8">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
            {publicLink && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>My booking page:</span>
                <Link 
                  href={`/booking/${profile?.username || ''}`} 
                  className="inline-flex items-center gap-1 font-semibold text-[#006bff] hover:underline"
                >
                  callendly.app/{profile?.username}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Quick Navigation Menu */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Calendar View', href: '/dashboard/calendar' },
              { label: 'Availability', href: '/dashboard/availability' },
              { label: 'Event Types', href: '/dashboard/event-types' },
              { label: 'Teams', href: '/dashboard/teams' },
              { label: 'Integrations', href: '/dashboard/integrations' },
              { label: 'Analytics', href: '/dashboard/analytics' }
            ].map(tab => (
              <Link
                key={tab.label}
                href={tab.href}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:border-gray-300 hover:text-black hover:shadow-sm transition-all"
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Dashboard Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* Main Bookings List Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
                <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Scheduled Meetings</h2>
                <div className="flex gap-1.5 bg-gray-50 p-1 rounded-full border border-gray-100">
                  <button
                    onClick={() => { setActiveTab('upcoming'); loadBookings('upcoming'); }}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                      activeTab === 'upcoming' 
                        ? 'bg-white text-[#006bff] shadow-sm' 
                        : 'text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    Upcoming
                  </button>
                  <button
                    onClick={() => { setActiveTab('past'); loadBookings('past'); }}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                      activeTab === 'past' 
                        ? 'bg-white text-[#006bff] shadow-sm' 
                        : 'text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    Past
                  </button>
                </div>
              </div>

              {/* Bookings Render */}
              <div className="space-y-4">
                {bookings.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400">
                    No {activeTab} meetings found.
                  </div>
                ) : (
                  bookings.map((booking) => (
                    <div 
                      key={booking.id} 
                      className="group flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className="mt-1 h-3.5 w-3.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: booking.eventType.color || '#3b82f6' }}
                        />
                        <div className="space-y-1">
                          <p className="font-bold text-sm text-gray-900">
                            {booking.eventType.title} with {booking.guestName}
                          </p>
                          <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            {format(parseISO(booking.startTime), 'MMM d, yyyy h:mm a')} - {format(parseISO(booking.endTime), 'h:mm a')}
                          </p>
                          {booking.location && (
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                              <span className="font-semibold">Location:</span> {booking.location}
                            </p>
                          )}
                          <p className="text-[10px] text-gray-400 font-semibold">{booking.guestEmail}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                        {activeTab === 'upcoming' && booking.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => fetchAiPrep(booking)}
                              className="rounded-full bg-purple-50 border border-purple-100 px-3 py-1.5 text-xs text-purple-700 font-bold hover:bg-purple-100 transition-colors flex items-center gap-1 shadow-sm shadow-purple-100"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-purple-500 animate-pulse" />
                              Prep Notes
                            </button>
                            <button
                              onClick={() => handleReschedule(booking.id)}
                              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleCancel(booking.id)}
                              className="rounded-full border border-red-100 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:border-red-200 hover:bg-red-50/50 transition-all"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
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

          {/* Right Column Panels */}
          <div className="space-y-8">
            
            {/* AI Scheduling Assistant widget */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-bl from-purple-500/10 to-transparent pointer-events-none" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-gradient-to-tr from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm shadow-purple-500/20">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <h3 className="font-extrabold text-[#7c3aed] text-sm tracking-tight">AI Scheduling Assistant</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">Paste a client request message to extract scheduling details and generate a reply template.</p>
              
              <textarea
                value={aiRequestText}
                onChange={e => setAiRequestText(e.target.value)}
                placeholder="e.g. Hi Deepanshu, can we meet this Friday morning to discuss the contract?"
                rows={3}
                className="w-full rounded-xl border border-gray-200 p-3 text-xs focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]/20 transition-all"
              />
              
              <button
                onClick={handleAiSuggest}
                disabled={aiSuggestLoading || !aiRequestText.trim()}
                className="w-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 py-2.5 text-xs font-bold text-white hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-purple-500/10"
              >
                {aiSuggestLoading ? 'Analyzing...' : 'Generate Suggestion'}
              </button>

              {aiSuggestResult && (
                <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100 space-y-3 text-xs animate-fadeIn">
                  <div className="grid grid-cols-2 gap-2 text-gray-700">
                    <div>
                      <span className="font-bold block text-[10px] text-gray-400 uppercase tracking-widest">Extracted Day</span>
                      <span className="font-bold">{aiSuggestResult.day}</span>
                    </div>
                    <div>
                      <span className="font-bold block text-[10px] text-gray-400 uppercase tracking-widest">Time Range</span>
                      <span className="font-bold">{aiSuggestResult.timeRange}</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-bold block text-[10px] text-gray-400 uppercase tracking-widest">Purpose</span>
                    <span className="font-bold">{aiSuggestResult.purpose}</span>
                  </div>
                  <div className="pt-3 border-t border-purple-100">
                    <span className="font-bold block text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Suggested Reply</span>
                    <textarea
                      readOnly
                      value={aiSuggestResult.suggestedResponse}
                      onClick={e => (e.target as any).select()}
                      className="w-full rounded-lg border border-purple-100 bg-white p-3 text-gray-600 focus:outline-none font-medium leading-relaxed"
                      rows={4}
                    />
                    <p className="text-[10px] text-gray-400 mt-1.5 italic">Click inside reply box to select and copy.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats Panel */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="font-extrabold text-sm tracking-tight border-b border-gray-100 pb-3 mb-4">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-gray-50/80 border border-gray-100 p-4 text-center">
                  <div className="text-2xl font-black text-gray-900">{bookings.length}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">{activeTab} meetings</div>
                </div>
                <div className="rounded-xl bg-gray-50/80 border border-gray-100 p-4 text-center">
                  <div className="text-2xl font-black text-gray-900">{eventTypes.length}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Event types</div>
                </div>
              </div>
            </div>

            {/* Event Types Preview Panel */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="font-extrabold text-sm tracking-tight border-b border-gray-100 pb-3 mb-4">Event Types</h3>
              <div className="space-y-3.5">
                {eventTypes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No event types configured yet.</p>
                ) : (
                  eventTypes.map((et) => (
                    <div key={et.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: et.color }} />
                        <span className="text-xs font-bold text-gray-800">{et.title}</span>
                      </div>
                      <span className="inline-flex items-center text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                        {et.duration} min
                      </span>
                    </div>
                  ))
                )}
              </div>
              <Link
                href="/dashboard/event-types"
                className="mt-5 block text-center text-xs font-bold text-[#006bff] hover:underline"
              >
                Manage event types
              </Link>
            </div>
            
          </div>
        </div>
      </main>

      {/* AI Prep Notes Drawer/Modal */}
      {selectedBookingForAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white p-8 shadow-2xl overflow-y-auto space-y-8 flex flex-col justify-between border-l border-gray-100">
            <div className="space-y-8">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight text-gray-900">AI Meeting Prep Notes</h3>
                  <p className="text-xs text-gray-400 font-semibold">{selectedBookingForAI.eventType.title} with {selectedBookingForAI.guestName}</p>
                </div>
                <button
                  onClick={() => setSelectedBookingForAI(null)}
                  className="rounded-full hover:bg-gray-100 p-2 text-gray-400 hover:text-black transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {aiPrepLoading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent" />
                  <p className="text-xs font-semibold text-gray-500">Consulting Sarvam AI for meeting insights...</p>
                </div>
              ) : aiPrepResult ? (
                <div className="space-y-8">
                  <div className="bg-purple-50/50 rounded-2xl p-5 border border-purple-100 space-y-2.5">
                    <h4 className="text-[10px] font-bold text-[#7c3aed] uppercase tracking-widest">AI Summary & Strategy</h4>
                    <p className="text-sm text-gray-700 leading-relaxed font-medium">{aiPrepResult.summary}</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Suggested Questions to Ask</h4>
                    <div className="space-y-3">
                      {aiPrepResult.questions.map((q, idx) => (
                        <div key={idx} className="flex gap-3 items-start bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                          <span className="flex items-center justify-center bg-purple-600 text-white rounded-full h-5 w-5 text-xs font-black shrink-0 mt-0.5 shadow-sm shadow-purple-500/10">
                            {idx + 1}
                          </span>
                          <p className="text-xs font-bold text-gray-700 leading-relaxed">{q}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No notes generated.</p>
              )}
            </div>

            <button
              onClick={() => setSelectedBookingForAI(null)}
              className="w-full py-3 rounded-full bg-black text-white text-xs font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-black/10"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
