'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { 
  User, Users, Check, Calendar as CalendarIcon, 
  Clock, ArrowRight, ArrowLeft, ShieldAlert,
  Globe, Sparkles, Plus, X, ChevronDown, Monitor, Copy
} from 'lucide-react';

interface Calendar {
  id: string;
  provider: string;
  name: string;
  isPrimary: boolean;
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Step 1 State: Usage & Goals
  const [useCase, setUseCase] = useState<'own' | 'team'>('own');
  const [goals, setGoals] = useState<string[]>(['schedule']);

  // Step 2 State: Role
  const [role, setRole] = useState<string>('Sales');

  // Step 3 State: Calendar Connections
  const [connectedCalendars, setConnectedCalendars] = useState<Calendar[]>([]);
  const [fetchingCals, setFetchingCals] = useState(false);

  // Step 4 State: Availability
  const [availability, setAvailability] = useState<{
    [key: number]: { active: boolean; start: string; end: string }
  }>({
    0: { active: false, start: '09:00', end: '17:00' }, // Sun
    1: { active: true, start: '09:00', end: '17:00' },  // Mon
    2: { active: true, start: '09:00', end: '17:00' },  // Tue
    3: { active: true, start: '09:00', end: '17:00' },  // Wed
    4: { active: true, start: '09:00', end: '17:00' },  // Thu
    5: { active: true, start: '09:00', end: '17:00' },  // Fri
    6: { active: false, start: '09:00', end: '17:00' }, // Sat
  });

  // Step 5 State: URL & Timezone
  const [username, setUsername] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [usernameError, setUsernameError] = useState('');

  // Validate Token & Load Saved Progress
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (!savedToken) {
      router.push('/login');
      return;
    }
    setToken(savedToken);
    setCheckingAuth(false);

    // Prefill timezone
    try {
      const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (systemTimezone) setTimezone(systemTimezone);
    } catch {}

    // Load saved onboarding wizard progress from local storage (if returning from OAuth)
    const savedProgress = localStorage.getItem('onboarding_progress');
    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress);
        if (parsed.useCase) setUseCase(parsed.useCase);
        if (parsed.goals) setGoals(parsed.goals);
        if (parsed.role) setRole(parsed.role);
        if (parsed.availability) setAvailability(parsed.availability);
        if (parsed.username) setUsername(parsed.username);
        if (parsed.timezone) setTimezone(parsed.timezone);
        if (parsed.step) setStep(parsed.step);
      } catch (e) {
        console.error('Error loading saved onboarding progress:', e);
      }
      localStorage.removeItem('onboarding_progress'); // Clear once loaded
    }

    // Prefill username from email prefix if empty & fetch profile
    api.get('/auth/me').then(res => {
      const user = res.data.user;
      setUserProfile(user);
      if (user && user.email && !username) {
        const prefix = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        setUsername(prefix);
      }
    }).catch(() => {});
  }, [router]);

  // Step 3: Fetch Connected Calendars on step load
  useEffect(() => {
    if (step === 3 && token) {
      setFetchingCals(true);
      api.get('/calendars')
        .then(res => {
          setConnectedCalendars(res.data.calendars || []);
          setFetchingCals(false);
        })
        .catch(() => setFetchingCals(false));
    }
  }, [step, token]);

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fcfcff]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#006bff] border-t-transparent" />
          <p className="text-sm font-medium text-gray-500">Checking session...</p>
        </div>
      </div>
    );
  }

  // Toggle Goal Select
  const toggleGoal = (id: string) => {
    if (goals.includes(id)) {
      setGoals(goals.filter(g => g !== id));
    } else {
      setGoals([...goals, id]);
    }
  };

  // Connect Google Calendar OAuth Flow
  const connectCalendar = () => {
    // Save current onboarding state to local storage before redirecting
    const progress = {
      useCase,
      goals,
      role,
      availability,
      username,
      timezone,
      step: 3 // Return to calendar page
    };
    localStorage.setItem('onboarding_progress', JSON.stringify(progress));

    // Redirect to backend OAuth route
    window.location.href = `/api/auth/google/calendar?state=${token}`;
  };

  // Check Username Availability
  const validateUsername = async (val: string) => {
    setUsername(val);
    if (!val) {
      setUsernameError('URL link name cannot be empty');
      return;
    }
    if (val.length < 3) {
      setUsernameError('Must be at least 3 characters');
      return;
    }
    // Simplistic regex validation
    if (!/^[a-zA-Z0-9-]+$/.test(val)) {
      setUsernameError('Only letters, numbers, and dashes allowed');
      return;
    }
    setUsernameError('');
  };

  // Disconnect calendar
  const disconnectCal = async (id: string) => {
    if (confirm('Are you sure you want to disconnect this calendar?')) {
      try {
        await api.delete(`/calendars/${id}`);
        setConnectedCalendars(connectedCalendars.filter(c => c.id !== id));
      } catch (err) {
        alert('Failed to disconnect calendar');
      }
    }
  };

  // Final Submit Flow
  const handleCompleteOnboarding = async () => {
    if (usernameError || !username) {
      alert('Please correct your booking URL before completing.');
      return;
    }
    setLoading(true);

    try {
      // 1. Submit Profile Settings
      const bioPayload = JSON.stringify({
        onboarded: true,
        useCase,
        goals,
        role
      });
      await api.put('/profile', {
        username,
        timezone,
        bio: bioPayload
      });

      // 2. Submit Availability Rules
      const rules = Object.keys(availability).map(dayKey => {
        const day = parseInt(dayKey);
        const rule = availability[day];
        return {
          dayOfWeek: day,
          startTime: rule.start,
          endTime: rule.end,
          isActive: rule.active
        };
      });
      await api.post('/availability', { rules });

      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  return (
    <div className="flex min-h-screen bg-[#fcfcff] text-gray-900 font-sans antialiased overflow-hidden">
      
      {/* LEFT COLUMN: Form Steps */}
      <div className="w-full lg:w-[60%] flex flex-col bg-white overflow-y-auto min-h-screen px-6 sm:px-12 lg:px-20 py-8">
        
        {/* Step Header */}
        <header className="flex items-center justify-between mb-8 sm:mb-16">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#006bff] text-white font-extrabold relative shadow-md shadow-[#006bff]/20">
              <span className="text-xl">C</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#006bff] flex items-center">
              Callendly
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Step {step} of 5
            </span>
            <div className="h-1.5 w-24 rounded-full bg-gray-100 overflow-hidden">
              <div 
                className="h-full bg-[#006bff] transition-all duration-300 ease-out" 
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>
        </header>

        {/* Dynamic Wizard Steps Container */}
        <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full pb-16">
          
          {/* STEP 1: Usage & Goals */}
          {step === 1 && (
            <div className="space-y-8 animate-slideInLeft">
              <div className="space-y-2">
                <span className="text-sm font-semibold text-[#006bff]">Welcome, {userProfile?.name?.split(' ')[0] || 'there'}!</span>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                  How do you plan on using Callendly?
                </h1>
                <p className="text-sm text-gray-500">Your responses will help us tailor your experience to your needs.</p>
              </div>

              {/* Usage Option Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setUseCase('own')}
                  className={`flex items-center gap-4 rounded-xl border p-5 text-left transition-all hover:border-[#006bff]/50 hover:shadow-sm ${
                    useCase === 'own' 
                      ? 'border-2 border-[#006bff] bg-blue-50/10 ring-1 ring-[#006bff]/10' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-2xl">☝️</span>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">On my own</h3>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUseCase('team')}
                  className={`flex items-center gap-4 rounded-xl border p-5 text-left transition-all hover:border-[#006bff]/50 hover:shadow-sm ${
                    useCase === 'team' 
                      ? 'border-2 border-[#006bff] bg-blue-50/10 ring-1 ring-[#006bff]/10' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-2xl">🤝</span>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">With my team</h3>
                  </div>
                </button>
              </div>

              {/* Goals list */}
              <div className="space-y-4 pt-2">
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm">How can Callendly help you?</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Select all that apply:</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'schedule', label: 'Schedule meetings', emoji: '📅' },
                    { id: 'attendees', label: 'Meet with multiple attendees', emoji: '👥' },
                    { id: 'contacts', label: 'Manage contact records', emoji: '📇' },
                    { id: 'payment', label: 'Collect payment', emoji: '💳' },
                    { id: 'emails', label: 'Automate pre/post meeting emails', emoji: '✉️' },
                    { id: 'transcribe', label: 'Record and transcribe meetings', emoji: '🎙️' }
                  ].map(g => {
                    const selected = goals.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGoal(g.id)}
                        className={`flex items-center justify-between rounded-xl border px-5 py-4 text-left text-sm font-semibold transition-all hover:shadow-sm ${
                          selected 
                            ? 'border-[#006bff] bg-blue-50/5 text-gray-900 ring-1 ring-[#006bff]/10' 
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{g.emoji}</span>
                          <span>{g.label}</span>
                        </div>
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          selected ? 'border-[#006bff] bg-[#006bff] text-white' : 'border-gray-300'
                        }`}>
                          {selected && <Check className="h-3 w-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step Navigation Actions */}
              <div className="flex justify-end pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#006bff] px-8 py-3 text-sm font-bold text-white hover:bg-[#0052cc] transition-all shadow-md shadow-[#006bff]/20"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Role Selection */}
          {step === 2 && (
            <div className="space-y-8 animate-slideInLeft">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">What is your role?</h1>
                <p className="mt-2 text-sm text-gray-500">Understanding your role will help us set up your first scheduling link.</p>
              </div>

              {/* Roles Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  { name: 'Finance', emoji: '💰' },
                  { name: 'Sales', emoji: '📈' },
                  { name: 'Customer success', emoji: '🎯' },
                  { name: 'Recruiting', emoji: '📋' },
                  { name: 'Marketing', emoji: '🚀' },
                  { name: 'Education', emoji: '📚' },
                  { name: 'Consulting', emoji: '💼' },
                  { name: 'Other', emoji: '🦄' }
                ].map(r => (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => setRole(r.name)}
                    className={`flex items-center gap-4 rounded-xl border px-5 py-4 text-left text-sm font-bold transition-all hover:border-gray-300 hover:shadow-sm ${
                      role === r.name 
                        ? 'border-[#006bff] bg-blue-50/5 text-gray-900 ring-1 ring-[#006bff]/10' 
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    <span className="text-lg">{r.emoji}</span>
                    <span>{r.name}</span>
                  </button>
                ))}
              </div>

              {/* Step Navigation Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-black transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#006bff] px-8 py-3 text-sm font-bold text-white hover:bg-[#0052cc] transition-all shadow-md shadow-[#006bff]/20"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Calendar Connection */}
          {step === 3 && (
            <div className="space-y-8 animate-slideInLeft">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                  Set which calendars we use to check for busy times
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                  Connecting your work or personal calendars prevents double bookings automatically.
                </p>
              </div>

              {/* Calendar Config Layout */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-6 shadow-sm">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Calendars to check for conflicts</h3>
                  <p className="text-[11px] text-gray-400 mt-1">Up to 6 work/personal calendars can be used to prevent double bookings</p>
                </div>

                {fetchingCals ? (
                  <div className="py-6 text-center text-xs text-gray-500 animate-pulse flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border border-[#006bff] border-t-transparent" />
                    Checking calendar connections...
                  </div>
                ) : connectedCalendars.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400 bg-gray-50/50">
                    No calendars connected yet.
                  </div>
                ) : (
                  <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden">
                    {connectedCalendars.map(cal => (
                      <div key={cal.id} className="p-4 bg-white space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-blue-50 text-[#006bff] rounded-lg flex items-center justify-center font-bold text-xs">
                              G
                            </div>
                            <div>
                              <span className="font-bold text-xs text-gray-900 block capitalize">{cal.provider}</span>
                              <span className="text-[10px] text-gray-400 block">{cal.name}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              Connected
                            </span>
                            <button
                              type="button"
                              onClick={() => disconnectCal(cal.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-[10px] text-gray-400 font-medium">
                          <span>Checking 1/1 sub-calendars</span>
                          <ChevronDown className="h-3 w-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={connectCalendar}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#006bff] bg-blue-50/5 py-4 text-xs font-bold text-[#006bff] hover:bg-blue-50/20 transition-all"
                >
                  <Plus className="h-4 w-4" /> Connect to your calendars
                </button>

                {/* Calendar to add meetings to */}
                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Calendar to add meetings to</h3>
                  <p className="text-[11px] text-gray-400">Choose one calendar to view all of your meetings</p>
                  
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4 bg-gray-50/30">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-blue-50 text-[#006bff] rounded-lg flex items-center justify-center font-bold text-xs">
                        G
                      </div>
                      <div>
                        <span className="font-bold text-xs text-gray-900 block">Google Calendar</span>
                        <span className="text-[10px] text-gray-400 block">Gmail, G Suite</span>
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Step Navigation Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-black transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#006bff] px-8 py-3 text-sm font-bold text-white hover:bg-[#0052cc] transition-all shadow-md shadow-[#006bff]/20"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Availability Selection */}
          {step === 4 && (
            <div className="space-y-8 animate-slideInLeft">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">When are you available to meet with people?</h1>
                <p className="mt-2 text-sm text-gray-500">You'll only be booked during these times. You can edit this schedule later.</p>
              </div>

              {/* Weekly hours editor card */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-6 shadow-sm">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <span className="text-base">🔄</span>
                  <div>
                    <span className="font-extrabold text-xs text-gray-900 block uppercase tracking-wider">Weekly hours</span>
                    <span className="text-[10px] text-gray-400 block">Set when you are typically available for meetings</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { key: 0, label: 'S', fullName: 'Sunday' },
                    { key: 1, label: 'M', fullName: 'Monday' },
                    { key: 2, label: 'T', fullName: 'Tuesday' },
                    { key: 3, label: 'W', fullName: 'Wednesday' },
                    { key: 4, label: 'T', fullName: 'Thursday' },
                    { key: 5, label: 'F', fullName: 'Friday' },
                    { key: 6, label: 'S', fullName: 'Saturday' }
                  ].map(day => {
                    const rule = availability[day.key];
                    return (
                      <div key={day.key} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-50 last:border-b-0 gap-3">
                        {/* Day indicator & toggle button */}
                        <div className="flex items-center gap-4 w-28 shrink-0">
                          <button
                            type="button"
                            onClick={() => setAvailability({
                              ...availability,
                              [day.key]: { ...rule, active: !rule.active }
                            })}
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold shrink-0 transition-all ${
                              rule.active 
                                ? 'bg-[#006bff] text-white shadow-sm' 
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            {day.label}
                          </button>
                          <span className="text-xs font-bold text-gray-700">{day.fullName}</span>
                        </div>

                        {/* Timing controls */}
                        {rule.active ? (
                          <div className="flex items-center gap-2.5">
                            <input
                              type="time"
                              value={rule.start}
                              onChange={e => setAvailability({
                                ...availability,
                                [day.key]: { ...rule, start: e.target.value }
                              })}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-800 focus:border-[#006bff] focus:outline-none focus:ring-1 focus:ring-[#006bff]/20"
                            />
                            <span className="text-gray-400 text-xs">—</span>
                            <input
                              type="time"
                              value={rule.end}
                              onChange={e => setAvailability({
                                ...availability,
                                [day.key]: { ...rule, end: e.target.value }
                              })}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-800 focus:border-[#006bff] focus:outline-none focus:ring-1 focus:ring-[#006bff]/20"
                            />
                            
                            {/* Copy/Options mocks */}
                            <button type="button" className="text-gray-400 hover:text-gray-600 p-1" title="Copy to all active days">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic font-medium w-full text-left sm:text-right pr-6">Unavailable</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step Navigation Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-black transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#006bff] px-8 py-3 text-sm font-bold text-white hover:bg-[#0052cc] transition-all shadow-md shadow-[#006bff]/20"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: URL & Timezone */}
          {step === 5 && (
            <div className="space-y-8 animate-slideInLeft">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">Create your booking link & timezone</h1>
                <p className="mt-2 text-sm text-gray-500">Pick a clean username URL that you will share with your clients.</p>
              </div>

              {/* Input Fields */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Choose your custom Callendly link</label>
                  <div className="flex rounded-xl border border-gray-300 bg-gray-50 overflow-hidden focus-within:border-[#006bff] focus-within:ring-1 focus-within:ring-[#006bff]/20">
                    <span className="bg-gray-100 border-r border-gray-200 text-gray-400 px-4 py-3 text-xs font-bold select-none flex items-center">
                      callendly.app/
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={e => validateUsername(e.target.value.toLowerCase())}
                      className="w-full bg-white px-4 py-3 text-sm focus:outline-none font-medium"
                      placeholder="john-doe"
                    />
                  </div>
                  {usernameError ? (
                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5" /> {usernameError}
                    </p>
                  ) : (
                    <p className="text-[10px] text-gray-400">You can change this username at any time in settings.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-gray-400" /> Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 focus:border-[#006bff] focus:outline-none focus:ring-1 focus:ring-[#006bff]/20"
                  >
                    <option value="UTC">UTC (Universal Time)</option>
                    <option value="Asia/Calcutta">Asia/Calcutta (IST)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Chicago">America/Chicago (CST)</option>
                    <option value="America/Denver">America/Denver (MST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                  </select>
                </div>
              </div>

              {/* Step Navigation Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-black transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleCompleteOnboarding}
                  disabled={loading || !!usernameError}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#006bff] px-8 py-3 text-sm font-bold text-white hover:bg-[#0052cc] transition-all disabled:opacity-50 shadow-md shadow-[#006bff]/20"
                >
                  {loading ? 'Completing...' : 'Complete & Go to Dashboard'} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT COLUMN: Decorative Previews Sidebar (40% width) */}
      <div className="hidden lg:flex lg:w-[40%] bg-[#f3f6fc] relative flex-col items-center justify-center p-8 sm:p-12 overflow-hidden border-l border-gray-100">
        
        {/* Wavy lines / circles floating - decorative background */}
        <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-[#006bff]/5 filter blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] rounded-full bg-purple-500/5 filter blur-3xl pointer-events-none" />

        {/* Floating geometric ornaments */}
        {/* Yellow Circle Outline */}
        <div className="absolute top-[20%] left-[15%] w-16 h-16 border-4 border-yellow-400 rounded-full opacity-25 animate-float-circle pointer-events-none" />
        {/* Purple Shield */}
        <div className="absolute bottom-[20%] right-[15%] w-24 h-24 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-2xl rotate-12 opacity-10 pointer-events-none shadow-lg shadow-purple-500/20 animate-float-shield" />
        {/* Wavy line mock - using border curves */}
        <div className="absolute top-[50%] right-[10%] w-32 h-16 border-b-4 border-r-4 border-green-400 rounded-br-[60px] opacity-20 pointer-events-none" />

        {/* STEP 1 & 3: Calendar Date/Time Picker Preview */}
        {(step === 1 || step === 3) && (
          <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-xl relative z-10 animate-slideUp">
            {/* Header info */}
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 text-[#006bff] flex items-center justify-center font-bold text-sm animate-pulse">
                {userProfile?.name ? userProfile.name[0] : 'U'}
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Select a Date & Time</h4>
                <p className="text-sm font-extrabold text-gray-900 mt-0.5">{userProfile?.name || 'My'} Scheduling Page</p>
              </div>
            </div>

            {/* Calendar widget mock */}
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-extrabold text-gray-700">
                <span>August</span>
                <div className="flex gap-2">
                  <button type="button" className="text-gray-400 hover:text-black">&lt;</button>
                  <button type="button" className="text-gray-400 hover:text-black">&gt;</button>
                </div>
              </div>

              {/* Grid of days */}
              <div className="grid grid-cols-7 gap-y-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
              </div>
              <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-bold text-gray-600">
                <span className="text-gray-200">30</span><span className="text-gray-200">31</span>
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                <span>6</span><span>7</span><span>8</span><span>9</span><span>10</span><span>11</span><span>12</span>
                <span>13</span>
                {/* Active slots in blue */}
                <span className="relative flex items-center justify-center">
                  <span className="absolute h-7 w-7 rounded-full bg-blue-50 text-[#006bff] flex items-center justify-center border border-[#006bff]/10">14</span>
                </span>
                <span className="relative flex items-center justify-center">
                  <span className="absolute h-7 w-7 rounded-full bg-blue-50 text-[#006bff] flex items-center justify-center border border-[#006bff]/10">15</span>
                </span>
                <span className="relative flex items-center justify-center">
                  <span className="absolute h-7 w-7 rounded-full bg-blue-50 text-[#006bff] flex items-center justify-center border border-[#006bff]/10">16</span>
                </span>
                <span className="relative flex items-center justify-center">
                  <span className="absolute h-7 w-7 rounded-full bg-blue-50 text-[#006bff] flex items-center justify-center border border-[#006bff]/10">17</span>
                </span>
                <span className="relative flex items-center justify-center">
                  <span className="absolute h-7 w-7 rounded-full bg-blue-50 text-[#006bff] flex items-center justify-center border border-[#006bff]/10">18</span>
                </span>
                <span>19</span>
                <span>20</span><span>21</span><span>22</span><span>23</span><span>24</span><span>25</span><span>26</span>
                <span>27</span><span>28</span><span>29</span><span>30</span><span>1</span><span>2</span><span>3</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Team Members Stacked Profile Preview */}
        {step === 2 && (
          <div className="w-full max-w-xs space-y-4 relative z-10 animate-slideUp">
            {[
              { name: 'Daniel', role: 'Account Executive', offset: 'translate-x-0' },
              { name: 'Elena', role: 'Customer Support', offset: 'translate-x-4' },
              { name: 'Jennifer', role: 'Marketing Manager', offset: 'translate-x-8' }
            ].map((member, idx) => (
              <div 
                key={member.name} 
                className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-lg flex items-center gap-4 transition-transform duration-500 hover:scale-105 ${member.offset}`}
                style={{ zIndex: 10 + idx }}
              >
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#006bff] to-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-sm shadow-[#006bff]/20">
                  {member.name[0]}
                </div>
                <div>
                  <h4 className="text-sm font-black text-gray-900">{member.name}</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{member.role}</p>
                  <div className="h-1 w-16 bg-blue-100 rounded-full mt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 4: Availability Dashboard Preview */}
        {step === 4 && (
          <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-xl relative z-10 animate-slideUp space-y-6">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Schedule</h4>
                <p className="text-sm font-extrabold text-gray-900 mt-0.5">Weekly Working Hours</p>
              </div>
              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                Active
              </span>
            </div>

            <div className="space-y-3 animate-fadeIn">
              {Object.keys(availability).map(dayKey => {
                const day = parseInt(dayKey);
                const rule = availability[day];
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return (
                  <div key={day} className="flex items-center justify-between text-xs font-bold text-gray-600">
                    <span className="text-gray-400 w-10">{dayNames[day]}</span>
                    {rule.active ? (
                      <span className="text-[#006bff] bg-blue-50/50 px-3 py-1 rounded-lg border border-[#006bff]/5">
                        {rule.start} — {rule.end}
                      </span>
                    ) : (
                      <span className="text-gray-300 italic font-medium">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5: Success Invite Preview */}
        {step === 5 && (
          <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-xl relative z-10 animate-slideUp text-center space-y-6">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-xl shadow-inner shadow-green-200/50">
              ✓
            </div>
            <div>
              <h4 className="text-base font-black text-gray-900">Confirmed</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                You are scheduled with {userProfile?.name || 'Host'}. Check your email inbox for invitations.
              </p>
            </div>
            
            <div className="border-t border-b border-gray-50 py-4 text-left space-y-2 text-xs font-bold text-gray-600 animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="text-lg">📅</span>
                <span>30 Minute Consultation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">⏰</span>
                <span>Friday, Aug 14 at 10:00 AM ({timezone})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">📍</span>
                <span>Google Meet Link Included</span>
              </div>
            </div>

            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              callendly.app/{username || 'username'}
            </div>
          </div>
        )}

      </div>
      
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#fcfcff]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#006bff] border-t-transparent" />
          <p className="text-sm font-medium text-gray-500">Loading onboarding...</p>
        </div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
