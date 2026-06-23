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
    if (!token) {
      router.push('/login');
      return;
    }
    fetchBookings();
  }, [router]);

  const handleCancel = async (id: string) => {
    const reason = window.prompt('Cancellation reason (optional):');
    try {
      await api.put(`/bookings/${id}/cancel`, { reason });
      // Update local state for both modal and calendar list
      if (selectedBooking && selectedBooking.id === id) {
        setSelectedBooking({
          ...selectedBooking,
          status: 'cancelled',
          guestNotes: selectedBooking.guestNotes ? `${selectedBooking.guestNotes} (Cancelled: ${reason || 'No reason provided'})` : `Cancelled: ${reason || 'No reason provided'}`
        });
      }
      fetchBookings();
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
      // Update local state
      if (selectedBooking && selectedBooking.id === id) {
        setSelectedBooking({
          ...selectedBooking,
          startTime: newDate,
          endTime: newEnd,
          status: 'rescheduled'
        });
      }
      fetchBookings();
    } catch (err) {
      alert('Failed to reschedule booking');
    }
  };

  // Month navigation helpers
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  // Calendar grid calculations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start week on Monday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const dayInterval = eachDayOfInterval({ start: startDate, end: endDate });

  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (loading && bookings.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg font-medium text-gray-500 animate-pulse">Loading calendar view...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold tracking-tight text-black hover:opacity-85 transition-opacity">
              Callendly
            </Link>
            <span className="h-5 w-px bg-gray-200" />
            <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">
              Dashboard
            </Link>
          </div>
          <div className="flex gap-2">
            <button
              onClick={goToToday}
              className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              Today
            </button>
            <div className="flex rounded-md shadow-sm">
              <button
                onClick={prevMonth}
                className="relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors"
                aria-label="Previous Month"
              >
                &larr;
              </button>
              <button
                onClick={nextMonth}
                className="relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors -ml-px"
                aria-label="Next Month"
              >
                &rarr;
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and view all your client bookings dynamically.
            </p>
          </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
          {/* Weekdays Header */}
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 py-3">
            {weekdayLabels.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-gray-100 bg-gray-100">
            {dayInterval.map((day, dayIdx) => {
              const dayBookings = bookings.filter((b) =>
                isSameDay(day, parseISO(b.startTime))
              );
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <div
                  key={day.toString()}
                  className={`min-h-[120px] bg-white p-2 flex flex-col justify-between transition-colors ${
                    isCurrentMonth ? 'text-gray-900' : 'bg-gray-50/50 text-gray-300'
                  } ${dayIdx < 7 ? 'border-t-0' : ''} ${dayIdx % 7 === 0 ? 'border-l-0' : ''}`}
                >
                  {/* Date number */}
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className={`text-xs font-bold flex h-6 w-6 items-center justify-center rounded-full ${
                        isSameDay(day, new Date())
                          ? 'bg-blue-600 text-white shadow-sm'
                          : ''
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayBookings.length > 0 && isCurrentMonth && (
                      <span className="text-[10px] font-semibold text-gray-400">
                        {dayBookings.length} {dayBookings.length === 1 ? 'mtg' : 'mtgs'}
                      </span>
                    )}
                  </div>

                  {/* Day's Meetings */}
                  <div className="flex-1 overflow-y-auto space-y-1 max-h-[85px] scrollbar-thin">
                    {dayBookings.map((booking) => {
                      const eventColor = booking.eventType?.color || '#3b82f6';
                      const isCancelled = booking.status === 'cancelled';
                      return (
                        <button
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate border transition-transform hover:scale-[1.02] flex items-center gap-1.5 ${
                            isCancelled
                              ? 'bg-gray-100 border-gray-200 text-gray-400 line-through'
                              : 'bg-white hover:bg-gray-50 text-gray-700'
                          }`}
                          style={{
                            borderLeft: isCancelled ? '3px solid #d1d5db' : `3px solid ${eventColor}`
                          }}
                        >
                          <span className="font-semibold text-gray-500">
                            {format(parseISO(booking.startTime), 'h:mm a')}
                          </span>
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

      {/* Meeting Details Modal Popup */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Close Button */}
            <button
              onClick={() => setSelectedBooking(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold p-1"
              aria-label="Close details"
            >
              &times;
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="h-4 w-4 rounded-full shadow-sm"
                style={{ backgroundColor: selectedBooking.eventType?.color || '#3b82f6' }}
              />
              <h2 className="text-xl font-extrabold text-gray-900">
                {selectedBooking.eventType?.title}
              </h2>
              <span
                className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                  selectedBooking.status === 'confirmed'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : selectedBooking.status === 'cancelled'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                }`}
              >
                {selectedBooking.status}
              </span>
            </div>

            {/* Modal Details Grid */}
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
                  <span className="col-span-2 text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 italic">
                    &ldquo;{selectedBooking.guestNotes}&rdquo;
                  </span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            {selectedBooking.status === 'confirmed' && (
              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  onClick={() => handleReschedule(selectedBooking.id)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Reschedule
                </button>
                <button
                  onClick={() => handleCancel(selectedBooking.id)}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors shadow-sm"
                >
                  Cancel Meeting
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
