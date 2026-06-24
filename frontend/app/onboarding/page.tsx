'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { 
  User, Users, Check, Calendar as CalendarIcon, 
  Clock, ArrowRight, ArrowLeft, ShieldAlert,
  HelpCircle, Briefcase, Zap, Globe, Sparkles
} from 'lucide-react';

interface Calendar {
  id: string;
  provider: string;
  name: string;
  isPrimary: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [token, setToken] = useState<string | null>(null);

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

    // Prefill username from email prefix if empty
    api.get('/auth/me').then(res => {
      const user = res.data.user;
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

      // 3. Create Default Event Type if missing, or update
      // The backend automatically creates default 15, 30, and 60-minute events on register, 
      // so we can directly redirect the user to the dashboard.
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
    <div className="flex min-h-screen flex-col bg-white text-gray-900 font-sans antialiased">
      {/* Top Header Navigation */}
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#006bff] text-white">
              <span className="text-sm font-bold">C</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-[#006bff]">Callendly</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Step {step} of 5
            </span>
            <div className="h-2 w-32 rounded-full bg-gray-100 overflow-hidden">
              <div 
                className="h-full bg-[#006bff] transition-all duration-300 ease-out" 
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Form Body */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 bg-[#fcfcff]">
        <div className="w-full max-w-2xl rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all duration-300">
          
          {/* STEP 1: Usage & Goals */}
          {step === 1 && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">How do you plan on using Callendly?</h1>
                <p className="mt-2 text-sm text-gray-500">Your responses will help us tailor your experience to your needs.</p>
              </div>

              {/* Usage Context Select */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setUseCase('own')}
                  className={`flex flex-col gap-4 rounded-xl border p-5 text-left transition-all hover:border-[#006bff] ${
                    useCase === 'own' 
                      ? 'border-2 border-[#006bff] bg-blue-50/20' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#006bff]/10 text-[#006bff]">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">On my own</h3>
                    <p className="text-xs text-gray-500 mt-1">For single scheduling, scheduling consultations, or freelancing.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUseCase('team')}
                  className={`flex flex-col gap-4 rounded-xl border p-5 text-left transition-all hover:border-[#006bff] ${
                    useCase === 'team' 
                      ? 'border-2 border-[#006bff] bg-blue-50/20' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">With my team</h3>
                    <p className="text-xs text-gray-500 mt-1">For collective schedules, cross-team organization, or departments.</p>
                  </div>
                </button>
              </div>

              {/* Goals Multi-Select */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 text-sm">How can Callendly help you? <span className="text-xs text-gray-400 font-normal">(Select all that apply)</span></h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'schedule', label: 'Schedule meetings', icon: CalendarIcon },
                    { id: 'attendees', label: 'Meet with multiple attendees', icon: Users },
                    { id: 'contacts', label: 'Manage contact records', icon: User },
                    { id: 'payment', label: 'Collect payment', icon: Sparkles },
                    { id: 'emails', label: 'Automate pre/post meeting emails', icon: Clock },
                    { id: 'transcribe', label: 'Record & transcribe meetings', icon: Sparkles }
                  ].map(g => {
                    const Selected = goals.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGoal(g.id)}
                        className={`flex items-center gap-3 rounded-lg border p-3.5 text-left text-xs font-semibold transition-all ${
                          Selected 
                            ? 'border-[#006bff] bg-blue-50/10 text-gray-900 ring-1 ring-[#006bff]' 
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                          Selected ? 'border-[#006bff] bg-[#006bff] text-white' : 'border-gray-300'
                        }`}>
                          {Selected && <Check className="h-3 w-3" />}
                        </div>
                        <span>{g.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step Navigation Actions */}
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#006bff] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0052cc] transition-colors"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Role Selection */}
          {step === 2 && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">What is your role?</h1>
                <p className="mt-2 text-sm text-gray-500">Understanding your role will help us set up your first scheduling link.</p>
              </div>

              {/* Roles List */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Sales', 'Customer success', 'Marketing', 'Consulting', 
                  'Finance', 'Recruiting', 'Education', 'Other'
                ].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex items-center gap-3 rounded-lg border p-4 text-left text-sm font-semibold transition-all ${
                      role === r 
                        ? 'border-[#006bff] bg-blue-50/10 text-gray-900 ring-1 ring-[#006bff]' 
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      role === r ? 'border-[#006bff] bg-[#006bff]' : 'border-gray-300'
                    }`}>
                      {role === r && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span>{r}</span>
                  </button>
                ))}
              </div>

              {/* Step Navigation Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-black"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#006bff] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0052cc] transition-colors"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Calendar Connection */}
          {step === 3 && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Set which calendars we use to check for busy times</h1>
                <p className="mt-2 text-sm text-gray-500">Connecting your work or personal calendars prevents double bookings automatically.</p>
              </div>

              {/* Calendar Config Box */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Calendars to check for conflicts</h3>
                  <p className="text-[11px] text-gray-400 mt-1">Up to 6 work/personal calendars can be used to prevent conflicts</p>
                </div>

                {fetchingCals ? (
                  <div className="py-4 text-center text-xs text-gray-500 animate-pulse">
                    Checking calendar connections...
                  </div>
                ) : connectedCalendars.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
                    No calendars connected yet.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {connectedCalendars.map(cal => (
                      <div key={cal.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 bg-blue-50 text-[#006bff] rounded-full flex items-center justify-center">
                            <CalendarIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-gray-900 block">{cal.name}</span>
                            <span className="text-[10px] text-gray-400 block capitalize">{cal.provider}</span>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" /> Connected
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={connectCalendar}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#006bff] bg-white py-3 text-xs font-bold text-[#006bff] hover:bg-blue-50/20 transition-all"
                >
                  <CalendarIcon className="h-4 w-4" /> + Connect to your calendars
                </button>
              </div>

              {/* Step Navigation Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-black"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#006bff] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0052cc] transition-colors"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Availability Selection */}
          {step === 4 && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">When are you available to meet with people?</h1>
                <p className="mt-2 text-sm text-gray-500">You'll only be booked during these times. You can edit this schedule later.</p>
              </div>

              {/* Availability Hours list */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="font-bold text-xs text-gray-500 uppercase tracking-widest">Weekly hours</span>
                </div>

                {[
                  { key: 0, label: 'Sunday' },
                  { key: 1, label: 'Monday' },
                  { key: 2, label: 'Tuesday' },
                  { key: 3, label: 'Wednesday' },
                  { key: 4, label: 'Thursday' },
                  { key: 5, label: 'Friday' },
                  { key: 6, label: 'Saturday' }
                ].map(day => {
                  const rule = availability[day.key];
                  return (
                    <div key={day.key} className="flex items-center gap-6 py-1">
                      {/* Day Checkbox */}
                      <button
                        type="button"
                        onClick={() => setAvailability({
                          ...availability,
                          [day.key]: { ...rule, active: !rule.active }
                        })}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0 transition-all ${
                          rule.active 
                            ? 'bg-[#006bff] text-white' 
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {day.label[0]}
                      </button>

                      <span className="w-24 text-sm font-semibold text-gray-700">{day.label}</span>

                      {rule.active ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={rule.start}
                            onChange={e => setAvailability({
                              ...availability,
                              [day.key]: { ...rule, start: e.target.value }
                            })}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-800 focus:border-[#006bff] focus:outline-none"
                          />
                          <span className="text-gray-400 text-xs">to</span>
                          <input
                            type="time"
                            value={rule.end}
                            onChange={e => setAvailability({
                              ...availability,
                              [day.key]: { ...rule, end: e.target.value }
                            })}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-800 focus:border-[#006bff] focus:outline-none"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Unavailable</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Step Navigation Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-black"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#006bff] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0052cc] transition-colors"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: URL & Timezone */}
          {step === 5 && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Create your booking link & timezone</h1>
                <p className="mt-2 text-sm text-gray-500">Pick a clean username URL that you will share with your clients.</p>
              </div>

              {/* Input Fields */}
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Choose your custom Callendly link</label>
                  <div className="flex rounded-md border border-gray-300 bg-gray-50 overflow-hidden focus-within:border-[#006bff]">
                    <span className="bg-gray-100 border-r border-gray-300 text-gray-500 px-3 py-2 text-sm select-none">
                      callendly.app/
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={e => validateUsername(e.target.value.toLowerCase())}
                      className="w-full bg-white px-3 py-2 text-sm focus:outline-none"
                      placeholder="john-doe"
                    />
                  </div>
                  {usernameError ? (
                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" /> {usernameError}
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400 mt-1.5">You can change this username at any time in settings.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5 text-gray-400" /> Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-[#006bff] focus:outline-none"
                  >
                    <option value="UTC">UTC (Universal Time)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
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
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-black"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleCompleteOnboarding}
                  disabled={loading || !!usernameError}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#006bff] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0052cc] transition-colors disabled:opacity-50"
                >
                  {loading ? 'Completing...' : 'Complete & Go to Dashboard'} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
