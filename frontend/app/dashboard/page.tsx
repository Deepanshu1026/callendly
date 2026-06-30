'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { format, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns';
import {
  ArrowRight,
  Clock,
  Sparkles,
  Download,
  Settings,
  LogOut,
  Calendar,
  Users,
  Link2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
  Copy,
  Zap,
  TrendingUp,
  Menu
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import Toast from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

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
  bookings?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { toasts, addToast, removeToast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'pending'>('upcoming');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [copied, setCopied] = useState(false);

  // AI Prep Notes
  const [selectedBookingForAI, setSelectedBookingForAI] = useState<Booking | null>(null);
  const [aiPrepLoading, setAiPrepLoading] = useState(false);
  const [aiPrepResult, setAiPrepResult] = useState<{ summary: string; questions: string[] } | null>(null);

  // AI Assistant
  const [aiRequestText, setAiRequestText] = useState('');
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggestResult, setAiSuggestResult] = useState<{ day: string; timeRange: string; purpose: string; suggestedResponse: string } | null>(null);

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: Calendar, active: true },
    { label: 'Calendar', href: '/dashboard/calendar', icon: Calendar },
    { label: 'Availability', href: '/dashboard/availability', icon: Clock },
    { label: 'Event Types', href: '/dashboard/event-types', icon: Zap },
    { label: 'Teams', href: '/dashboard/teams', icon: Users },
    { label: 'Integrations', href: '/dashboard/integrations', icon: Link2 },
    { label: 'Analytics', href: '/dashboard/analytics', icon: TrendingUp },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

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
        if (profile?.bio) {
          try {
            const parsedBio = JSON.parse(profile.bio);
            if (parsedBio?.onboarded) needsOnboarding = false;
          } catch { needsOnboarding = false; }
        }
        if (needsOnboarding) { router.push('/onboarding'); return; }

        setUser(fetchedUser);
        setBookings(bookingsRes.data.bookings);
        setEventTypes(eventsRes.data.eventTypes);
      } catch (err) {
        console.error(err);
        addToast('Failed to load dashboard', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, addToast]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) return;

    const socket = io({ path: '/socket.io', auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join', user.id));
    socket.on('booking_created', () => loadBookings(activeTab));
    socket.on('booking_pending', () => loadBookings(activeTab));
    socket.on('booking_updated', () => loadBookings(activeTab));
    return () => { socket.disconnect(); };
  }, [user?.id]);

  const loadBookings = async (tab: 'upcoming' | 'past' | 'pending') => {
    try {
      const url = tab === 'pending' ? '/bookings?status=pending' : `/bookings?${tab === 'upcoming' ? 'upcoming=true' : 'past=true'}`;
      const res = await api.get(url);
      setBookings(res.data.bookings);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async (id: string) => {
    const reason = window.prompt('Cancellation reason (optional):');
    if (reason === null) return;
    try {
      await api.put(`/bookings/${id}/cancel`, { reason });
      loadBookings(activeTab);
      addToast('Booking cancelled', 'success');
    } catch (err) {
      addToast('Failed to cancel booking', 'error');
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
      addToast('Booking rescheduled', 'success');
    } catch (err) {
      addToast('Failed to reschedule booking', 'error');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.put(`/bookings/${id}/approve`);
      loadBookings(activeTab);
      addToast('Booking approved', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to approve', 'error');
    }
  };

  const handleDecline = async (id: string) => {
    const reason = window.prompt('Reason for declining (optional):');
    if (reason === null) return;
    try {
      await api.put(`/bookings/${id}/decline`, { reason });
      loadBookings(activeTab);
      addToast('Booking declined', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to decline', 'error');
    }
  };

  const handleNoShow = async (id: string) => {
    if (!confirm('Mark this booking as no-show?')) return;
    try {
      await api.put(`/bookings/${id}/no-show`);
      loadBookings(activeTab);
      addToast('Marked as no-show', 'success');
    } catch {
      addToast('Failed to mark no-show', 'error');
    }
  };

  const handleDownloadICS = (id: string) => {
    window.open(`/api/bookings/${id}/ics`, '_blank');
  };

  const handleCopyLink = () => {
    if (!user?.profile?.username) return;
    const url = `${window.location.origin}/booking/${user.profile.username}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    addToast('Booking link copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    if (socketRef.current) socketRef.current.disconnect();
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
      addToast('Failed to generate AI prep notes', 'error');
    } finally {
      setAiPrepLoading(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!aiRequestText.trim()) return;
    setAiSuggestLoading(true);
    setAiSuggestResult(null);
    try {
      const res = await api.post('/ai/suggest-slots', { requestText: aiRequestText });
      setAiSuggestResult(res.data);
    } catch {
      addToast('Failed to parse request with AI', 'error');
    } finally {
      setAiSuggestLoading(false);
    }
  };

  const formatBookingDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEE, MMM d');
  };

  const getStatusIcon = (status: string) => {
    if (status === 'confirmed') return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    if (status === 'cancelled') return <XCircle className="h-3.5 w-3.5 text-red-600" />;
    if (status === 'pending') return <AlertCircle className="h-3.5 w-3.5 text-amber-600" />;
    return <AlertCircle className="h-3.5 w-3.5 text-orange-600" />;
  };

  const getStatusStyle = (status: string) => {
    if (status === 'confirmed') return 'bg-green-50 text-green-700 border-green-100';
    if (status === 'cancelled') return 'bg-red-50 text-red-700 border-red-100';
    if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (status === 'no-show') return 'bg-orange-50 text-orange-700 border-orange-100';
    return 'bg-blue-50 text-blue-700 border-blue-100';
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafbfe]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#006bff] border-t-transparent" />
          <p className="text-sm font-semibold text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const profile = user?.profile;
  const publicLink = profile?.username ? `${window.location.origin}/booking/${profile.username}` : '';

  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 font-sans">
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#006bff] flex items-center justify-center text-white font-black">C</div>
          <span className="font-bold text-lg">Callendly</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg hover:bg-gray-100">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <div className="flex max-w-[1600px] mx-auto">
        {/* Sidebar */}
        <aside className={`${mobileMenuOpen ? 'fixed inset-0 z-40 bg-white' : 'hidden'} lg:block lg:relative lg:w-64 lg:shrink-0 lg:bg-white lg:border-r lg:border-gray-200 lg:min-h-screen`}>
          <div className="hidden lg:flex items-center gap-3 px-6 py-5 border-b border-gray-100">
            <div className="h-8 w-8 rounded-lg bg-[#006bff] flex items-center justify-center text-white font-black shadow-md shadow-[#006bff]/20">C</div>
            <span className="font-bold text-xl tracking-tight">Callendly</span>
          </div>

          <div className="p-4 lg:p-5 space-y-1">
            <p className="hidden lg:block text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">Menu</p>
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  item.active
                    ? 'bg-[#006bff] text-white shadow-md shadow-[#006bff]/15'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>

          <div className="lg:hidden p-4 border-t border-gray-100">
            <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl">
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          {/* Top Bar */}
          <div className="hidden lg:flex items-center justify-between px-8 py-4 bg-white/50 backdrop-blur-sm border-b border-gray-200/60">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-xs text-gray-500">Welcome back, {user?.name || 'there'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right mr-2">
                <p className="text-xs font-bold text-gray-900">{user?.name}</p>
                <p className="text-[10px] text-gray-400">{user?.email}</p>
              </div>
              <Link href="/dashboard/settings" className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm">
                <Settings className="h-4 w-4" />
              </Link>
              <button onClick={handleLogout} className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all shadow-sm">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
            {/* Public Link Banner */}
            {publicLink && (
              <div className="rounded-2xl bg-gradient-to-r from-[#006bff] to-[#5b8def] p-5 text-white shadow-lg shadow-[#006bff]/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">Your booking link is ready</h2>
                    <p className="text-sm text-white/80 mt-1">Share this link with people so they can book time with you.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2.5 text-sm font-medium truncate max-w-[260px]">
                      callendly.app/{profile?.username}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#006bff] hover:bg-white/90 transition-all shadow-sm"
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Upcoming', value: activeTab === 'upcoming' ? bookings.length : confirmedBookings.length, icon: Calendar, color: 'bg-blue-50 text-blue-600' },
                { label: 'Pending', value: pendingCount, icon: AlertCircle, color: 'bg-amber-50 text-amber-600' },
                { label: 'Event Types', value: eventTypes.length, icon: Zap, color: 'bg-purple-50 text-purple-600' },
                { label: 'Cancelled', value: cancelledCount, icon: XCircle, color: 'bg-red-50 text-red-600' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${stat.color} mb-3`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <p className="text-2xl font-black text-gray-900">{stat.value}</p>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Bookings Panel */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-[#006bff]/10 flex items-center justify-center text-[#006bff]">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Scheduled Meetings</h2>
                        <p className="text-xs text-gray-500">Manage your upcoming bookings</p>
                      </div>
                    </div>
                    <div className="flex gap-1 bg-gray-50 p-1 rounded-full border border-gray-100">
                      {(['upcoming', 'pending', 'past'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => { setActiveTab(tab); loadBookings(tab); }}
                          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                            activeTab === tab ? 'bg-white text-[#006bff] shadow-sm' : 'text-gray-400 hover:text-gray-900'
                          }`}
                        >
                          {tab === 'pending' && pendingCount > 0 ? (
                            <span className="flex items-center gap-1.5">
                              {tab.charAt(0).toUpperCase() + tab.slice(1)}
                              <span className="bg-amber-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-[9px]">{pendingCount}</span>
                            </span>
                          ) : (
                            tab.charAt(0).toUpperCase() + tab.slice(1)
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-50">
                    {bookings.length === 0 ? (
                      <div className="py-16 text-center">
                        <div className="mx-auto h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                          <Calendar className="h-7 w-7 text-gray-300" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900">No {activeTab} meetings</h3>
                        <p className="text-xs text-gray-400 mt-1 max-w-[280px] mx-auto">
                          {activeTab === 'pending'
                            ? 'No bookings are waiting for your approval.'
                            : 'Share your booking link to start getting meetings on your calendar.'}
                        </p>
                        {activeTab !== 'pending' && (
                          <Link href="/dashboard/event-types" className="inline-block mt-4 text-xs font-bold text-[#006bff] hover:underline">
                            Manage event types <ChevronRight className="inline h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    ) : (
                      bookings.map((booking) => (
                        <div key={booking.id} className="group p-5 hover:bg-gray-50/50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                            {/* Time Column */}
                            <div className="sm:w-28 shrink-0">
                              <p className="text-xs font-bold text-gray-900 uppercase">{formatBookingDate(booking.startTime)}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {format(parseISO(booking.startTime), 'h:mm a')} - {format(parseISO(booking.endTime), 'h:mm a')}
                              </p>
                            </div>

                            {/* Main Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: booking.eventType.color || '#3b82f6' }} />
                                <p className="font-bold text-sm text-gray-900 truncate">
                                  {booking.eventType.title} with {booking.guestName}
                                </p>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${getStatusStyle(booking.status)}`}>
                                  {getStatusIcon(booking.status)}
                                  {booking.status}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 truncate">{booking.guestEmail}</p>
                              {booking.location && (
                                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                  <span className="font-medium">Location:</span> {booking.location}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {booking.status === 'pending' && (
                                <>
                                  <button onClick={() => handleApprove(booking.id)} className="rounded-full bg-green-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-green-700 transition-colors shadow-sm">
                                    Approve
                                  </button>
                                  <button onClick={() => handleDecline(booking.id)} className="rounded-full bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 text-xs font-bold hover:bg-red-100 transition-colors">
                                    Decline
                                  </button>
                                </>
                              )}
                              {(activeTab === 'upcoming' || activeTab === 'pending') && booking.status === 'confirmed' && (
                                <>
                                  <button onClick={() => fetchAiPrep(booking)} className="rounded-full bg-purple-50 text-purple-700 border border-purple-100 px-3 py-1.5 text-xs font-bold hover:bg-purple-100 transition-colors flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" /> Prep
                                  </button>
                                  <button onClick={() => handleDownloadICS(booking.id)} className="rounded-full bg-white text-gray-600 border border-gray-200 px-3 py-1.5 text-xs font-bold hover:bg-gray-50 transition-colors flex items-center gap-1">
                                    <Download className="h-3 w-3" /> .ics
                                  </button>
                                  <button onClick={() => handleReschedule(booking.id)} className="rounded-full bg-white text-gray-600 border border-gray-200 px-3 py-1.5 text-xs font-bold hover:bg-gray-50 transition-colors">
                                    Reschedule
                                  </button>
                                  <button onClick={() => handleCancel(booking.id)} className="rounded-full bg-white text-red-600 border border-red-100 px-3 py-1.5 text-xs font-bold hover:bg-red-50 transition-colors">
                                    Cancel
                                  </button>
                                </>
                              )}
                              {activeTab === 'past' && booking.status === 'confirmed' && (
                                <button onClick={() => handleNoShow(booking.id)} className="rounded-full bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1.5 text-xs font-bold hover:bg-orange-100 transition-colors">
                                  No-show
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Sidebar */}
              <div className="space-y-6">
                {/* AI Assistant */}
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm overflow-hidden relative">
                  <div className="absolute top-0 right-0 h-20 w-20 bg-gradient-to-bl from-purple-500/10 to-transparent pointer-events-none" />
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-7 w-7 bg-gradient-to-tr from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="font-extrabold text-[#7c3aed] text-sm tracking-tight">AI Assistant</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Paste a client message to extract scheduling details.</p>
                  <textarea
                    value={aiRequestText}
                    onChange={e => setAiRequestText(e.target.value)}
                    placeholder="e.g. Can we meet this Friday morning?"
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 p-3 text-xs focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]/20 mb-3"
                  />
                  <button
                    onClick={handleAiSuggest}
                    disabled={aiSuggestLoading || !aiRequestText.trim()}
                    className="w-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 py-2.5 text-xs font-bold text-white hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md"
                  >
                    {aiSuggestLoading ? 'Analyzing...' : 'Generate Suggestion'}
                  </button>

                  {aiSuggestResult && (
                    <div className="mt-4 bg-purple-50/50 rounded-xl p-4 border border-purple-100 space-y-3 text-xs animate-fadeIn">
                      <div className="grid grid-cols-2 gap-2 text-gray-700">
                        <div><span className="font-bold block text-[10px] text-gray-400 uppercase">Day</span><span className="font-bold">{aiSuggestResult.day}</span></div>
                        <div><span className="font-bold block text-[10px] text-gray-400 uppercase">Time</span><span className="font-bold">{aiSuggestResult.timeRange}</span></div>
                      </div>
                      <div><span className="font-bold block text-[10px] text-gray-400 uppercase">Purpose</span><span className="font-bold">{aiSuggestResult.purpose}</span></div>
                      <div className="pt-3 border-t border-purple-100">
                        <span className="font-bold block text-[10px] text-gray-400 uppercase mb-1.5">Reply</span>
                        <textarea readOnly value={aiSuggestResult.suggestedResponse} onClick={e => (e.target as any).select()} className="w-full rounded-lg border border-purple-100 bg-white p-2.5 text-gray-600 focus:outline-none" rows={3} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Event Types Preview */}
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                    <h3 className="font-extrabold text-sm tracking-tight">Event Types</h3>
                    <Link href="/dashboard/event-types" className="text-[10px] font-bold text-[#006bff] hover:underline">Manage</Link>
                  </div>
                  <div className="space-y-3">
                    {eventTypes.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No event types yet.</p>
                    ) : (
                      eventTypes.slice(0, 5).map((et) => (
                        <div key={et.id} className="flex items-center justify-between group">
                          <div className="flex items-center gap-2.5">
                            <div className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: et.color }} />
                            <span className="text-xs font-semibold text-gray-800">{et.title}</span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                            {et.duration} min
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <Link href="/dashboard/event-types" className="mt-4 flex items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 px-4 py-2 text-xs font-bold text-gray-500 hover:border-[#006bff] hover:text-[#006bff] transition-colors">
                    <Sparkles className="h-3 w-3" /> Create New Event Type
                  </Link>
                </div>

                {/* Quick Actions */}
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <h3 className="font-extrabold text-sm tracking-tight border-b border-gray-100 pb-3 mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <Link href="/dashboard/availability" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors"><Clock className="h-4 w-4" /></div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-900">Update Availability</p>
                        <p className="text-[10px] text-gray-400">Set your weekly hours</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </Link>
                    <Link href="/dashboard/integrations" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className="h-8 w-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center group-hover:bg-green-100 transition-colors"><Link2 className="h-4 w-4" /></div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-900">Connect Calendar</p>
                        <p className="text-[10px] text-gray-400">Sync with Google</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </Link>
                    <Link href="/dashboard/settings" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className="h-8 w-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center group-hover:bg-gray-200 transition-colors"><Settings className="h-4 w-4" /></div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-900">Profile Settings</p>
                        <p className="text-[10px] text-gray-400">Edit your profile</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* AI Prep Drawer */}
      {selectedBookingForAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white p-8 shadow-2xl overflow-y-auto space-y-8 flex flex-col justify-between border-l border-gray-100">
            <div className="space-y-8">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight text-gray-900">AI Meeting Prep</h3>
                  <p className="text-xs text-gray-400 font-semibold">{selectedBookingForAI.eventType.title} with {selectedBookingForAI.guestName}</p>
                </div>
                <button onClick={() => setSelectedBookingForAI(null)} className="rounded-full hover:bg-gray-100 p-2 text-gray-400 hover:text-black">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {aiPrepLoading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent" />
                  <p className="text-xs font-semibold text-gray-500">Consulting Sarvam AI...</p>
                </div>
              ) : aiPrepResult ? (
                <div className="space-y-8">
                  <div className="bg-purple-50/50 rounded-2xl p-5 border border-purple-100 space-y-2.5">
                    <h4 className="text-[10px] font-bold text-[#7c3aed] uppercase tracking-widest">Summary</h4>
                    <p className="text-sm text-gray-700 leading-relaxed font-medium">{aiPrepResult.summary}</p>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Suggested Questions</h4>
                    <div className="space-y-3">
                      {aiPrepResult.questions.map((q, idx) => (
                        <div key={idx} className="flex gap-3 items-start bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                          <span className="flex items-center justify-center bg-purple-600 text-white rounded-full h-5 w-5 text-xs font-black shrink-0 mt-0.5">{idx + 1}</span>
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
            <button onClick={() => setSelectedBookingForAI(null)} className="w-full py-3 rounded-full bg-black text-white text-xs font-bold hover:bg-gray-800 shadow-lg shadow-black/10">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
