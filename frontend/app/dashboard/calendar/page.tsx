'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  parseISO
} from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Download, Settings, ArrowLeft } from 'lucide-react';

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

export default function CalendarViewPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bookings');
      setBookings(res.data.bookings || []);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchBookings();
  }, [router]);

  const handleCancel = async (id: string) => {
    const reason = window.prompt('Cancellation reason (optional):');
    if (reason === null) return;
    try {
      await api.put(`/bookings/${id}/cancel`, { reason });
      setSelectedBooking(null);
      fetchBookings();
    } catch (err) {
      alert('Failed to cancel booking');
    }
  };

  const handleReschedule = async (id: string) => {
    const newDate = window.prompt('Enter new start time (ISO format):');
    if (!newDate) return;
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;
    const durationMs = new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime();
    const newEnd = new Date(new Date(newDate).getTime() + durationMs).toISOString();
    try {
      await api.put(`/bookings/${id}/reschedule`, { newStartTime: newDate, newEndTime: newEnd });
      setSelectedBooking(null);
      fetchBookings();
    } catch (err) {
      alert('Failed to reschedule booking');
    }
  };

  const handleNoShow = async (id: string) => {
    if (!confirm('Mark this booking as no-show?')) return;
    try {
      await api.put(`/bookings/${id}/no-show`);
      setSelectedBooking(null);
      fetchBookings();
    } catch {
      alert('Failed to mark no-show');
    }
  };

  const handleDownloadICS = (id: string) => {
    window.open(`/api/bookings/${id}/ics`, '_blank');
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const dayInterval = eachDayOfInterval({ start: startDate, end: endDate });

  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const getStatusStyle = (status: string) => {
    if (status === 'confirmed') return 'bg-green-50 text-green-700 border-green-100';
    if (status === 'cancelled') return 'bg-red-50 text-red-700 border-red-100';
    if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (status === 'no-show') return 'bg-orange-50 text-orange-700 border-orange-100';
    return 'bg-blue-50 text-blue-700 border-blue-100';
  };

  if (loading && bookings.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#006bff] border-t-transparent" />
          <p className="text-sm font-semibold text-gray-500">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 font-sans">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#006bff] text-white shadow-md shadow-[#006bff]/20">
              <span className="text-base font-black">C</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">Callendly<span className="text-[#006bff]">.</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="hidden sm:flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:border-gray-300 hover:text-black transition-all shadow-sm">
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <Link href="/dashboard/settings" className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all shadow-sm">
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h1>
            <p className="mt-1 text-sm text-gray-500">View and manage all your bookings.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={goToToday} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
              Today
            </button>
            <div className="flex rounded-xl shadow-sm border border-gray-300 overflow-hidden">
              <button onClick={prevMonth} className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-600 transition-colors border-r border-gray-300">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={nextMonth} className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-600 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-bold uppercase tracking-wider text-gray-500 py-3">
            {weekdayLabels.map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-gray-100 bg-gray-100">
            {dayInterval.map((day, dayIdx) => {
              const dayBookings = bookings.filter((b) => isSameDay(day, parseISO(b.startTime)));
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <div
                  key={day.toString()}
                  className={`min-h-[130px] bg-white p-2 flex flex-col justify-between transition-colors ${
                    isCurrentMonth ? 'text-gray-900' : 'bg-gray-50/50 text-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-bold flex h-6 w-6 items-center justify-center rounded-full ${isSameDay(day, new Date()) ? 'bg-[#006bff] text-white shadow-sm' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    {dayBookings.length > 0 && isCurrentMonth && (
                      <span className="text-[10px] font-semibold text-gray-400">{dayBookings.length} {dayBookings.length === 1 ? 'mtg' : 'mtgs'}</span>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[90px]">
                    {dayBookings.map((booking) => {
                      const eventColor = booking.eventType?.color || '#3b82f6';
                      const isCancelled = booking.status === 'cancelled';
                      return (
                        <button
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className={`w-full text-left px-1.5 py-1 rounded text-[10px] font-semibold truncate border transition-transform hover:scale-[1.02] flex items-center gap-1.5 ${
                            isCancelled ? 'bg-gray-100 border-gray-200 text-gray-400 line-through' : 'bg-white hover:bg-gray-50 text-gray-700'
                          }`}
                          style={{ borderLeft: isCancelled ? '3px solid #d1d5db' : `3px solid ${eventColor}` }}
                        >
                          <span className="font-semibold text-gray-500">{format(parseISO(booking.startTime), 'h:mm a')}</span>
                          <span className="truncate">{booking.guestName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button onClick={() => setSelectedBooking(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold p-1">
              &times;
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: selectedBooking.eventType?.color || '#3b82f6' }} />
              <h2 className="text-xl font-extrabold text-gray-900">{selectedBooking.eventType?.title}</h2>
              <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${getStatusStyle(selectedBooking.status)}`}>
                {selectedBooking.status}
              </span>
            </div>

            <div className="space-y-4 border-t border-gray-100 pt-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-gray-500">Date & Time</span>
                <span className="col-span-2 text-gray-800 font-medium">
                  {format(parseISO(selectedBooking.startTime), 'EEEE, MMMM d, yyyy')}<br />
                  {format(parseISO(selectedBooking.startTime), 'h:mm a')} - {format(parseISO(selectedBooking.endTime), 'h:mm a')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-gray-500">Guest</span>
                <span className="col-span-2 text-gray-800">
                  <span className="font-semibold">{selectedBooking.guestName}</span> ({selectedBooking.guestEmail})
                  {selectedBooking.guestPhone && <div className="text-xs text-gray-500 mt-0.5">Phone: {selectedBooking.guestPhone}</div>}
                </span>
              </div>
              {selectedBooking.location && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-gray-500">Location</span>
                  <span className="col-span-2 text-gray-800 font-medium">{selectedBooking.location}</span>
                </div>
              )}
              {selectedBooking.guestNotes && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-gray-500">Guest Notes</span>
                  <span className="col-span-2 text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 italic">&ldquo;{selectedBooking.guestNotes}&rdquo;</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
              <button onClick={() => handleDownloadICS(selectedBooking.id)} className="rounded-full bg-white border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1">
                <Download className="h-3 w-3" /> .ics
              </button>
              {selectedBooking.status === 'confirmed' && (
                <>
                  <button onClick={() => handleReschedule(selectedBooking.id)} className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                    Reschedule
                  </button>
                  <button onClick={() => handleNoShow(selectedBooking.id)} className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-600 hover:bg-orange-100 transition-colors">
                    No-show
                  </button>
                  <button onClick={() => handleCancel(selectedBooking.id)} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-colors">
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
