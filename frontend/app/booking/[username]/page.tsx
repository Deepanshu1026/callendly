'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { format, addDays, startOfWeek, parseISO } from 'date-fns';

interface Question {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: string;
  order: number;
}

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration: number;
  location: string | null;
  color: string;
  requiresPayment?: boolean;
  price?: number;
  currency?: string;
  questions?: Question[];
}

interface Host {
  id: string;
  name: string | null;
}

interface Slot {
  startTime: string;
  endTime: string;
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

  // Load Razorpay script dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

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

  // Fetch full details (questions & pricing) and slots
  useEffect(() => {
    if (!selectedEventType || !username) return;

    // Fetch full public event type details
    api.get(`/event-types/${username}/${selectedEventType.slug}/public`)
      .then(res => {
        setSelectedEventType(res.data.eventType);
      })
      .catch(err => console.error('Failed to load event type details:', err));
  }, [username, selectedEventType?.slug]);

  useEffect(() => {
    if (!selectedEventType || !username) return;
    api.get(`/availability/${username}/${selectedEventType.slug}/slots?date=${selectedDate}`)
      .then(res => setSlots(res.data.slots))
      .catch(() => setSlots([]));
  }, [username, selectedEventType?.slug, selectedDate]);

  const handleBooking = async () => {
    if (!selectedEventType || !selectedSlot) return;
    setBookingLoading(true);
    try {
      // 1. Submit pending/confirmed booking
      const res = await api.post(`/bookings/${username}/${selectedEventType.slug}`, {
        ...formData,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        answers
      });

      const { booking, requiresPayment, price, currency } = res.data;

      if (requiresPayment) {
        // 2. Create Razorpay order
        const orderRes = await api.post('/payments/create-order', {
          bookingId: booking.id,
          amount: price,
          currency: currency || 'INR'
        });

        const { orderId, amount, currency: orderCurrency, keyId } = orderRes.data;

        // 3. Open Razorpay modal checkout
        const options = {
          key: keyId,
          amount: amount,
          currency: orderCurrency,
          name: 'Callendly Scheduling',
          description: `${selectedEventType.title} with ${host?.name || username}`,
          order_id: orderId,
          handler: async function (response: any) {
            try {
              // 4. Verify payment with backend
              const verifyRes = await api.post('/payments/verify', {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                bookingId: booking.id
              });
              if (verifyRes.data.success) {
                setStep('confirmed');
              } else {
                alert('Payment verification failed. Please contact support.');
              }
            } catch (err: any) {
              alert(err.response?.data?.error || 'Verification failed');
            } finally {
              setBookingLoading(false);
            }
          },
          prefill: {
            name: formData.guestName,
            email: formData.guestEmail,
            contact: formData.guestPhone
          },
          theme: {
            color: selectedEventType.color || '#3b82f6'
          },
          modal: {
            ondismiss: function () {
              setBookingLoading(false);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        setStep('confirmed');
        setBookingLoading(false);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Booking failed');
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
                {selectedEventType.requiresPayment && selectedEventType.price && (
                  <div className="flex items-center gap-2 font-semibold text-green-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Price: {selectedEventType.currency || 'INR'} {selectedEventType.price}
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
                      <p className="text-sm text-gray-500">
                        {et.duration} min {et.requiresPayment && et.price ? `| ${et.currency || 'INR'} ${et.price}` : ''}
                      </p>
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

                {/* Custom Booking Questions */}
                {selectedEventType?.questions && selectedEventType.questions.map((q: any) => {
                  let optionsList: string[] = [];
                  if (q.type === 'select' && q.options) {
                    try {
                      optionsList = JSON.parse(q.options);
                      if (!Array.isArray(optionsList)) {
                        optionsList = String(q.options).split(',').map(o => o.trim());
                      }
                    } catch {
                      optionsList = String(q.options).split(',').map(o => o.trim());
                    }
                  }

                  return (
                    <div key={q.id}>
                      <label className="block text-sm font-medium text-gray-700">
                        {q.label} {q.required && '*'}
                      </label>
                      {q.type === 'textarea' ? (
                        <textarea
                          required={q.required}
                          value={answers[q.id] || ''}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          rows={3}
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      ) : q.type === 'select' ? (
                        <select
                          required={q.required}
                          value={answers[q.id] || ''}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black animate-none"
                        >
                          <option value="">Select an option</option>
                          {optionsList.map((opt, idx) => (
                            <option key={idx} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : 'text'}
                          required={q.required}
                          value={answers[q.id] || ''}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      )}
                    </div>
                  );
                })}

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep('select')}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleBooking}
                    disabled={
                      bookingLoading ||
                      !formData.guestName ||
                      !formData.guestEmail ||
                      (selectedEventType?.questions || []).some((q: any) => q.required && !answers[q.id])
                    }
                    className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {bookingLoading ? 'Confirming...' : selectedEventType?.requiresPayment ? `Pay & Book (${selectedEventType.currency || 'INR'} ${selectedEventType.price})` : 'Confirm Booking'}
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

