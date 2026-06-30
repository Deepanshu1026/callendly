'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { api } from '@/lib/api';
import { format, parseISO, startOfMonth, endOfMonth, getDay, isToday, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function GuestRescheduleForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [slots, setSlots] = useState<{ startTime: string; endTime: string }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    if (token) {
      fetchSlots(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedDate]);

  const fetchSlots = async (date: string) => {
    setSlotsLoading(true);
    try {
      const res = await api.get(`/availability/guest/${token}/slots?date=${date}`);
      setSlots(res.data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedSlot) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.put(`/bookings/guest/${token}/reschedule`, {
        newStartTime: selectedSlot.startTime,
        newEndTime: selectedSlot.endTime
      });
      setBooking(res.data.booking);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reschedule');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800">Invalid Link</h1>
          <p className="mt-2 text-gray-500 text-sm">This reschedule link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (success && booking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Booking Rescheduled!</h1>
          <p className="mt-2 text-sm text-gray-500">
            New time: {format(parseISO(booking.startTime), 'EEEE, MMMM d, yyyy h:mm a')}
          </p>
          <p className="mt-1 text-xs text-gray-400">A confirmation email has been sent.</p>
        </div>
      </div>
    );
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const totalDaysInMonth = monthEnd.getDate();
  const firstDayIndex = getDay(monthStart);
  const leadingDays = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900">Reschedule Booking</h1>
          <p className="text-sm text-gray-500 mt-1">Select a new date and time for your meeting.</p>
          {error && <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        </div>

        <div className="flex flex-col md:flex-row">
          <div className="p-6 border-r border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} className="p-1 rounded border border-gray-200 hover:bg-gray-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="font-bold text-sm">{format(currentMonth, 'MMMM yyyy')}</h3>
              <button onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} className="p-1 rounded border border-gray-200 hover:bg-gray-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 uppercase mb-2">
              <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {Array.from({ length: leadingDays }).map((_, i) => <div key={`e-${i}`} className="h-8" />)}
              {Array.from({ length: totalDaysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const dateStr = format(date, 'yyyy-MM-dd');
                const isPast = date < today;
                const isSelected = selectedDate === dateStr;

                return (
                  <button
                    key={day}
                    onClick={() => { if (!isPast) { setSelectedDate(dateStr); setSelectedSlot(null); fetchSlots(dateStr); } }}
                    disabled={isPast}
                    className={`h-8 rounded-full text-xs font-semibold transition-all ${
                      isSelected ? 'bg-blue-600 text-white' : isPast ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-blue-50'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6 flex-1 max-h-[300px] overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">
              {format(parseISO(selectedDate + 'T00:00:00'), 'EEEE, MMM d')}
            </h3>
            {slotsLoading ? (
              <div className="space-y-2">{Array.from({length:3}).map((_,i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-200" />)}</div>
            ) : slots.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No available slots</p>
            ) : (
              <div className="space-y-2">
                {slots.map((slot, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSlot(slot)}
                    className={`w-full py-2 px-3 rounded-lg border text-sm font-semibold transition-all ${
                      selectedSlot?.startTime === slot.startTime ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    {format(parseISO(slot.startTime), 'h:mm a')} - {format(parseISO(slot.endTime), 'h:mm a')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <Link href="/" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
          <button
            onClick={handleReschedule}
            disabled={loading || !selectedSlot}
            className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GuestReschedulePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <GuestRescheduleForm />
    </Suspense>
  );
}
