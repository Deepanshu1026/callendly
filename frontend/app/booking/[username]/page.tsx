'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { format, addDays, startOfWeek, parseISO } from 'date-fns';

interface Slot {
  startTime: string;
  endTime: string;
}

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration: number;
  location: string | null;
  color: string;
}

interface Host {
  id: string;
  name: string | null;
}

export default function BookingPage() {
  const params = useParams();
  const username = params.username as string;

  const [host, setHost] = useState<Host | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [step, setStep] = useState<'list' | 'select' | 'form' | 'confirmed'>('list');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    guestNotes: ''
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    if (!username) return;
    api.get(`/users/${username}/public`)
      .then(res => {
        const ets = res.data.profile.user.eventTypes || [];
        setEventTypes(ets);
        setHost({ id: res.data.profile.user.id, name: res.data.profile.user.name });
        if (ets.length === 1) {
          setSelectedEventType(ets[0]);
          setStep('select');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (!selectedEventType || !username) return;
    api.get(`/availability/${username}/${selectedEventType.slug}/slots?date=${selectedDate}`)
      .then(res => setSlots(res.data.slots))
      .catch(() => setSlots([]));
  }, [username, selectedEventType, selectedDate]);

  const handleBooking = async () => {
    if (!selectedEventType || !selectedSlot) return;
    setBookingLoading(true);
    try {
      await api.post(`/bookings/${username}/${selectedEventType.slug}`, {
        ...formData,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        answers
      });
      setStep('confirmed');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Booking failed');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!host || eventTypes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Page not found</h1>
          <p className="mt-2 text-gray-500">This booking page does not exist or has no available events.</p>
        </div>
      </div>
    );
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  if (step === 'confirmed') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Booking confirmed!</h2>
          <p className="mt-2 text-gray-500">
            You&apos;ve scheduled a {selectedEventType?.title} with {host?.name || username}.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            A confirmation email has been sent to {formData.guestEmail}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link href="/" className="text-sm font-medium text-gray-600 hover:text-black">
            &larr; Callendly
          </Link>
        </div>

        <div className="grid gap-6 rounded-xl border border-gray-200 bg-white shadow-sm md:grid-cols-3">
          <div className="border-b border-gray-200 p-6 md:border-b-0 md:border-r">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                {(host.name || username).charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-gray-500">{host?.name || username}</p>
                <h1 className="text-xl font-bold">
                  {step === 'list' ? 'Select Event Type' : selectedEventType?.title}
                </h1>
              </div>
            </div>
            {step !== 'list' && selectedEventType && (
              <div className="mt-6 space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {selectedEventType.duration} minutes
                </div>
                {selectedEventType.location && (
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {selectedEventType.location}
                  </div>
                )}
              </div>
            )}
            {selectedEventType?.description && (
              <p className="mt-4 text-sm text-gray-500">{selectedEventType.description}</p>
            )}
            {step !== 'list' && (
              <button
                onClick={() => { setStep('list'); setSelectedEventType(null); setSelectedSlot(null); }}
                className="mt-4 text-sm text-blue-600 hover:underline"
              >
                Change event type
              </button>
            )}
          </div>

          {step === 'list' ? (
            <div className="p-6 md:col-span-2">
              <h2 className="mb-4 font-semibold">Select an Event Type</h2>
              <div className="space-y-3">
                {eventTypes.map(et => (
                  <button
                    key={et.id}
                    onClick={() => { setSelectedEventType(et); setStep('select'); }}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium">{et.title}</p>
                      <p className="text-sm text-gray-500">{et.duration} min</p>
                    </div>
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: et.color }} />
                  </button>
                ))}
              </div>
            </div>
          ) : step === 'select' ? (
            <div className="p-6 md:col-span-2">
              <h2 className="mb-4 font-semibold">Select a Date & Time</h2>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {weekDays.map((d) => {
                  const dStr = format(d, 'yyyy-MM-dd');
                  return (
                    <button
                      key={dStr}
                      onClick={() => setSelectedDate(dStr)}
                      className={`flex flex-col items-center rounded-lg px-4 py-2 text-sm ${
                        selectedDate === dStr ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <span className="text-xs uppercase">{format(d, 'EEE')}</span>
                      <span className="font-semibold">{format(d, 'd')}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                {slots.length === 0 ? (
                  <p className="text-sm text-gray-500">No available slots for this date.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {slots.map((slot, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setStep('form');
                        }}
                        className="rounded-md border border-gray-300 py-2 text-sm font-medium hover:bg-gray-50"
                      >
                        {format(parseISO(slot.startTime), 'h:mm a')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 md:col-span-2">
              <h2 className="mb-4 font-semibold">Enter Details</h2>
              <p className="mb-4 text-sm text-gray-500">
                {format(parseISO(selectedSlot!.startTime), 'EEEE, MMMM d')} at {format(parseISO(selectedSlot!.startTime), 'h:mm a')}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name *</label>
                  <input
                    required
                    value={formData.guestName}
                    onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.guestEmail}
                    onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    value={formData.guestPhone}
                    onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Additional notes</label>
                  <textarea
                    rows={3}
                    value={formData.guestNotes}
                    onChange={(e) => setFormData({ ...formData, guestNotes: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep('select')}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleBooking}
                    disabled={bookingLoading || !formData.guestName || !formData.guestEmail}
                    className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {bookingLoading ? 'Confirming...' : 'Confirm Booking'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
