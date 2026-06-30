'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { 
  format, 
  parseISO,
  startOfMonth,
  endOfMonth,
  getDay,
  isToday,
  addMonths,
  subMonths,
  startOfDay 
} from 'date-fns';
import { 
  Clock, 
  MapPin, 
  Globe, 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft, 
  Calendar,
  CheckCircle2,
  Link2,
  Wrench
} from 'lucide-react';

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
  availabilityRules?: any[];
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
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [step, setStep] = useState<'list' | 'select' | 'form' | 'confirmed'>('list');
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    guestNotes: ''
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bookingLoading, setBookingLoading] = useState(false);
  const [lastBookingId, setLastBookingId] = useState<string>('');
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

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

  // Fetch Host & Event Types
  useEffect(() => {
    if (!username) return;
    api.get(`/users/${username}/public`)
      .then(res => {
        const ets = res.data.profile.user.eventTypes || [];
        setEventTypes(ets);
        setHost({ 
          id: res.data.profile.user.id, 
          name: res.data.profile.user.name,
          availabilityRules: res.data.profile.user.availabilityRules || []
        });
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

  // Fetch slots for selected date
  useEffect(() => {
    if (!selectedEventType || !username) return;
    setSlotsLoading(true);
    api.get(`/availability/${username}/${selectedEventType.slug}/slots?date=${selectedDate}`)
      .then(res => {
        setSlots(res.data.slots);
        setSlotsLoading(false);
      })
      .catch(() => {
        setSlots([]);
        setSlotsLoading(false);
      });
  }, [username, selectedEventType?.slug, selectedDate]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  // Helper: check if date is selectable based on host availability rules and current time
  const isDateAvailable = (dateToCheck: Date) => {
    const today = startOfDay(new Date());
    const target = startOfDay(dateToCheck);
    if (target < today) return false;

    const dayOfWeek = dateToCheck.getDay();
    if (host?.availabilityRules && host.availabilityRules.length > 0) {
      return host.availabilityRules.some(r => r.dayOfWeek === dayOfWeek && r.isActive);
    }
    // Default fallback: Mon - Fri
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  };

  const getFormattedTimezone = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const options: Intl.DateTimeFormatOptions = {
        timeZone: tz,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      };
      const timeString = new Intl.DateTimeFormat('en-US', options).format(new Date());
      return `${tz.replace(/_/g, ' ')} (${timeString.toLowerCase()})`;
    } catch {
      return 'UTC';
    }
  };

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

      const { booking, requiresPayment, requiresConfirmation, price, currency } = res.data;
      setLastBookingId(booking.id);

      if (requiresConfirmation) {
        setPendingConfirmation(true);
        setStep('confirmed');
        setBookingLoading(false);
        return;
      }

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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-semibold text-gray-500">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (!host || eventTypes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg border border-gray-150">
          <h1 className="text-2xl font-bold text-gray-800">Page not found</h1>
          <p className="mt-2 text-gray-500 text-sm">
            This booking page does not exist or has no available events.
          </p>
          <Link href="/" className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Monthly Calendar Calculations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const totalDaysInMonth = monthEnd.getDate();
  const firstDayIndex = getDay(monthStart);
  // Shift Sunday index (0) to end of week representation (leading days index count for Monday start)
  const leadingDays = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  if (step === 'confirmed') {
    const isPending = pendingConfirmation;

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 md:p-10 text-center shadow-xl border border-gray-100 relative overflow-hidden">
          
          {/* Banner Ribbon */}
          <div className="absolute top-0 right-0 overflow-hidden w-24 h-24 pointer-events-none">
            <div className={`absolute top-3 right-[-28px] transform rotate-45 text-[8px] font-bold text-white py-1 px-8 shadow-sm tracking-wider uppercase whitespace-nowrap text-center ${isPending ? 'bg-amber-500' : 'bg-green-600'}`}>
              {isPending ? 'Pending' : 'Confirmed'}
            </div>
          </div>

          <div className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full ${isPending ? 'bg-amber-50 text-amber-500' : 'bg-green-50 text-green-500'}`}>
            <CheckCircle2 className="h-8 w-8 stroke-[2]" />
          </div>
          
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
            {isPending ? 'Booking Request Sent!' : 'Booking Confirmed!'}
          </h2>
          <p className="mt-3 text-sm text-gray-500 font-medium">
            {isPending
              ? 'Your booking request has been sent to '
              : 'You are scheduled with ' }
            <span className="font-semibold text-gray-800">{host?.name || username}</span>.
          </p>

          <div className="mt-8 border-t border-b border-gray-100 py-6 text-left space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-800">{selectedEventType?.title}</p>
                {selectedSlot && (
                  <p className="mt-0.5 text-xs text-gray-500 font-semibold">
                    {format(parseISO(selectedSlot.startTime), 'h:mm a')} - {format(parseISO(selectedSlot.endTime), 'h:mm a')}, {format(parseISO(selectedSlot.startTime), 'EEEE, MMMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>

            {selectedEventType?.location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-gray-800">Location</p>
                  <p className="mt-0.5 text-xs text-gray-500 font-semibold">{selectedEventType.location}</p>
                </div>
              </div>
            )}
          </div>

          <p className="mt-6 text-xs text-gray-400 font-medium">
            {isPending
              ? 'A confirmation email will be sent once the host approves your request.'
              : 'A confirmation email has been sent to '}
            {!isPending && <span className="font-semibold text-gray-600">{formData.guestEmail}</span>}.
          </p>
          
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {!isPending && (
              <a
                href={`/api/bookings/${lastBookingId}/ics`}
                download
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-sm font-bold transition-all shadow-md"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Add to Calendar
              </a>
            )}
            <Link 
              href="/"
              className="inline-block rounded-xl bg-gray-900 hover:bg-black text-white px-6 py-3 text-sm font-bold transition-all shadow-md"
            >
              Close
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="w-full bg-white border-b border-gray-150 py-3.5 px-6 md:px-12 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-lg text-gray-900 tracking-tight flex items-center gap-1.5">
            <span className="h-6 w-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">C</span>
            Callendly
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-1 transition-colors">
            Menu
            <ChevronRight className="h-4 w-4 transform rotate-90" />
          </button>
          <button 
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 active:scale-95 shadow-sm"
          >
            <Link2 className="h-4 w-4 text-gray-400" />
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-12 md:py-16 flex items-center justify-center">
        <div className="relative w-full rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden min-h-[520px] flex flex-col md:flex-row">
          
          {/* Diagonal Powered-by ribbon */}
          <div className="absolute top-0 right-0 overflow-hidden w-28 h-28 pointer-events-none z-10">
            <div className="absolute top-4 right-[-36px] transform rotate-45 bg-[#4b5563] text-[8px] font-bold text-white py-1.5 px-10 tracking-widest text-center shadow-md uppercase whitespace-nowrap">
              Callendly
            </div>
          </div>

          {/* Left Panel: Event Info */}
          <div className="w-full md:w-[350px] p-8 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col justify-between shrink-0 bg-white">
            <div>
              {step !== 'list' ? (
                <button
                  onClick={() => {
                    if (step === 'form') {
                      setStep('select');
                    } else {
                      setStep('list');
                      setSelectedEventType(null);
                      setSelectedSlot(null);
                    }
                  }}
                  className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : (
                <div className="mb-6 h-12 w-12 rounded-full bg-blue-600 text-white font-bold text-lg flex items-center justify-center shadow-md">
                  {(host.name || username).charAt(0).toUpperCase()}
                </div>
              )}

              <p className="text-xs font-bold text-gray-400 tracking-widest uppercase">
                {host?.name || username}
              </p>
              <h1 className="mt-2 text-2xl font-black text-gray-900 leading-tight">
                {step === 'list' ? 'Select Event Type' : selectedEventType?.title}
              </h1>

              {step !== 'list' && selectedEventType && (
                <div className="mt-6 space-y-4 text-sm text-gray-600 font-semibold">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400 shrink-0" />
                    <span>{selectedEventType.duration} minutes</span>
                  </div>
                  
                  {selectedEventType.location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-gray-400 shrink-0" />
                      <span>{selectedEventType.location}</span>
                    </div>
                  )}

                  {step === 'form' && selectedSlot && (
                    <div className="flex items-start gap-3 text-blue-600 font-bold bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                      <Calendar className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                      <span>
                        {format(parseISO(selectedSlot.startTime), 'h:mm a')} - {format(parseISO(selectedSlot.endTime), 'h:mm a')},<br />
                        {format(parseISO(selectedSlot.startTime), 'EEEE, MMMM d, yyyy')}
                      </span>
                    </div>
                  )}

                  {selectedEventType.requiresPayment && selectedEventType.price && (
                    <div className="flex items-center gap-3 font-bold text-green-600">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[10px] text-green-700 font-bold shrink-0">$</span>
                      <span>Price: {selectedEventType.currency || 'INR'} {selectedEventType.price}</span>
                    </div>
                  )}
                </div>
              )}

              {selectedEventType?.description && (
                <p className="mt-6 text-sm text-gray-500 leading-relaxed font-medium">
                  {selectedEventType.description}
                </p>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <a href="#" className="hover:text-gray-600 transition-colors">Cookie settings</a>
              <a href="#" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
            </div>
          </div>

          {/* Right Panel: Interactive Step Pages */}
          <div className="flex-1 flex flex-col md:flex-row bg-white">
            
            {/* List Step */}
            {step === 'list' && (
              <div className="flex-1 p-8">
                <h2 className="text-lg font-bold text-gray-800 mb-6">Select an Event Type</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {eventTypes.map(et => (
                    <button
                      key={et.id}
                      onClick={() => { setSelectedEventType(et); setStep('select'); }}
                      className="group relative flex flex-col justify-between rounded-2xl border border-gray-200 p-6 text-left hover:border-blue-500 hover:shadow-lg transition-all duration-300 bg-white overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-2.5 h-full" style={{ backgroundColor: et.color }} />
                      <div className="pl-3">
                        <p className="font-extrabold text-gray-800 group-hover:text-blue-600 transition-colors text-base">{et.title}</p>
                        <p className="mt-2.5 text-sm text-gray-500 flex items-center gap-1.5 font-semibold">
                          <Clock className="h-4 w-4 text-gray-400" />
                          {et.duration} min {et.requiresPayment && et.price ? `| ${et.currency || 'INR'} ${et.price}` : ''}
                        </p>
                        {et.location && (
                          <p className="mt-1.5 text-xs text-gray-400 font-semibold truncate max-w-[200px] flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-gray-300" />
                            {et.location}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Calendar Select Step */}
            {step === 'select' && (
              <>
                {/* Date Grid Panel */}
                <div className="flex-1 p-8">
                  <h2 className="text-lg font-extrabold text-gray-900 mb-6">Select a Date & Time</h2>
                  
                  {/* Calendar Month Header */}
                  <div className="flex items-center justify-between mb-6 px-1">
                    <button 
                      onClick={handlePrevMonth}
                      className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors border border-gray-200"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h3 className="font-black text-gray-800 text-base">
                      {format(currentMonth, 'MMMM yyyy')}
                    </h3>
                    <button 
                      onClick={handleNextMonth}
                      className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors border border-gray-200"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Week Day Titles */}
                  <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div>Sat</div>
                    <div>Sun</div>
                  </div>

                  {/* Calendar Matrix */}
                  <div className="grid grid-cols-7 gap-y-3 text-center text-sm font-semibold">
                    {Array.from({ length: leadingDays }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-10 w-10" />
                    ))}
                    
                    {Array.from({ length: totalDaysInMonth }).map((_, i) => {
                      const dayNumber = i + 1;
                      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNumber);
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const isSelectable = isDateAvailable(date);
                      const isSelected = selectedDate === dateStr;
                      const isCurrentDay = isToday(date);
                      
                      return (
                        <div key={dayNumber} className="flex items-center justify-center">
                          <button
                            onClick={() => {
                              if (isSelectable) {
                                setSelectedDate(dateStr);
                                setSelectedSlot(null);
                              }
                            }}
                            disabled={!isSelectable}
                            className={`h-10 w-10 rounded-full flex flex-col items-center justify-center transition-all duration-200 relative ${
                              isSelected
                                ? 'bg-blue-600 text-white font-extrabold shadow-md shadow-blue-200 scale-105'
                                : isSelectable
                                  ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-105 font-bold'
                                  : 'text-gray-300 cursor-not-allowed'
                            }`}
                          >
                            <span>{dayNumber}</span>
                            {isCurrentDay && !isSelected && (
                              <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Timezone dropdown info */}
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                      <Globe className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>Time zone:</span>
                      <span className="text-gray-800 font-semibold">{getFormattedTimezone()}</span>
                    </div>
                  </div>
                </div>

                {/* Slots Panel */}
                <div className="w-full md:w-[280px] p-8 border-t md:border-t-0 md:border-l border-gray-100 flex flex-col max-h-[500px] overflow-y-auto shrink-0 bg-gray-50 md:bg-white animate-slideInLeft">
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-6">
                    {format(parseISO(selectedDate + 'T00:00:00'), 'EEEE, MMM d')}
                  </h3>
                  
                  {slotsLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-gray-200" />
                      ))}
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
                      <Calendar className="h-10 w-10 mb-2 stroke-[1.5]" />
                      <p className="text-xs font-bold uppercase tracking-wider">No available slots</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-1">
                      {slots.map((slot, idx) => {
                        const timeFormatted = format(parseISO(slot.startTime), 'h:mm a');
                        const isSelected = selectedSlot?.startTime === slot.startTime;
                        
                        return (
                          <div key={idx} className="flex gap-2 transition-all duration-300">
                            <button
                              onClick={() => setSelectedSlot(slot)}
                              className={`flex-1 py-3 px-4 rounded-xl border text-sm font-bold transition-all duration-300 ${
                                isSelected 
                                  ? 'border-blue-600 bg-blue-50 text-blue-600 text-center' 
                                  : 'border-gray-200 text-gray-700 bg-white hover:border-blue-500 hover:bg-gray-50'
                              }`}
                            >
                              {timeFormatted}
                            </button>
                            {isSelected && (
                              <button
                                onClick={() => setStep('form')}
                                className="px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all duration-300 shadow-md shadow-blue-100 animate-slideInLeft shrink-0"
                              >
                                Next
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Troubleshoot Footer element */}
                  <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center">
                    <button className="text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                      <Wrench className="h-3 w-3" />
                      Troubleshoot
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Form Step */}
            {step === 'form' && (
              <div className="flex-1 p-8 overflow-y-auto max-h-[540px]">
                <h2 className="text-lg font-bold text-gray-800 mb-6">Enter Details</h2>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Name *</label>
                    <input
                      required
                      placeholder="Your Name"
                      value={formData.guestName}
                      onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="your.email@example.com"
                      value={formData.guestEmail}
                      onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={formData.guestPhone}
                      onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Additional Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Please share anything that will help prepare for our meeting."
                      value={formData.guestNotes}
                      onChange={(e) => setFormData({ ...formData, guestNotes: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
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
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                          {q.label} {q.required && '*'}
                        </label>
                        {q.type === 'textarea' ? (
                          <textarea
                            required={q.required}
                            placeholder={q.label}
                            value={answers[q.id] || ''}
                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                            rows={3}
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
                          />
                        ) : q.type === 'select' ? (
                          <select
                            required={q.required}
                            value={answers[q.id] || ''}
                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800 appearance-none"
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
                            placeholder={q.label}
                            value={answers[q.id] || ''}
                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
                          />
                        )}
                      </div>
                    );
                  })}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setStep('select')}
                      className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
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
                      className="flex-1 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-md shadow-blue-100"
                    >
                      {bookingLoading ? 'Confirming...' : selectedEventType?.requiresPayment ? `Pay & Book (${selectedEventType.currency || 'INR'} ${selectedEventType.price})` : 'Schedule Event'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
