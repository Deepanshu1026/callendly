'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowRight, Check, Calendar, ShieldCheck, Zap, 
  Users, Sparkles, Clock, Globe, ArrowUpRight, Lock 
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      router.push('/dashboard');
    } else {
      setCheckingAuth(false);
    }
  }, [router]);

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fcfcff]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#006bff] border-t-transparent" />
          <p className="text-sm font-medium text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      router.push(`/signup?email=${encodeURIComponent(emailInput.trim())}`);
    } else {
      router.push('/signup');
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 selection:bg-[#006bff]/10 font-sans antialiased overflow-x-hidden">
      
      {/* Decorative top-right background gradient */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#006bff]/5 filter blur-3xl pointer-events-none" />
      <div className="absolute top-[20%] left-[-100px] w-[350px] h-[350px] rounded-full bg-purple-500/5 filter blur-3xl pointer-events-none" />

      {/* Sticky Premium Header */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#006bff] text-white font-extrabold relative shadow-md shadow-[#006bff]/20">
              <span className="text-lg">C</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">
              Callendly<span className="text-[#006bff]">.</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-gray-500">
            <a href="#features" className="hover:text-black transition-colors">Features</a>
            <a href="#integrations" className="hover:text-black transition-colors">Integrations</a>
            <a href="#pricing" className="hover:text-black transition-colors">Pricing</a>
            <a href="#about" className="hover:text-black transition-colors">About</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-xs font-bold text-gray-600 hover:text-black transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#006bff] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0052cc] transition-all shadow-md shadow-[#006bff]/10"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="relative">
        
        {/* HERO SECTION */}
        <section className="mx-auto max-w-7xl px-6 pt-16 pb-24 md:py-32 grid gap-12 lg:grid-cols-12 items-center">
          
          {/* Hero text (Left column) */}
          <div className="lg:col-span-6 space-y-8 animate-slideInLeft">
            <h1 className="text-5xl md:text-6xl font-black text-gray-900 tracking-tight leading-[1.1]">
              Easy <br className="hidden sm:inline" />
              scheduling <br className="hidden sm:inline" />
              <span className="text-[#006bff] bg-gradient-to-r from-[#006bff] to-blue-500 bg-clip-text text-transparent">ahead.</span>
            </h1>
            
            <p className="text-base text-gray-500 leading-relaxed max-w-lg">
              Callendly helps you schedule meetings without the back-and-forth emails. Share your link, check conflicts automatically, and focus on what matters.
            </p>

            {/* Email form field */}
            <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md">
              <input
                type="email"
                placeholder="Enter your email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                className="w-full rounded-full border border-gray-200 bg-[#f9fafc] px-5 py-3.5 text-sm focus:border-[#006bff] focus:outline-none focus:ring-1 focus:ring-[#006bff]/20 font-medium transition-all"
              />
              <button
                type="submit"
                className="rounded-full bg-[#006bff] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#0052cc] transition-all whitespace-nowrap shadow-lg shadow-[#006bff]/20"
              >
                Sign up for free
              </button>
            </form>

            {/* Alternative Auth options */}
            <div className="flex items-center gap-6 text-xs text-gray-400">
              <span>Or sign up with:</span>
              <button 
                onClick={() => window.location.href = '/api/auth/google'}
                className="flex items-center gap-1.5 font-bold hover:text-black transition-colors"
              >
                Google
              </button>
              <span>•</span>
              <Link href="/signup" className="font-bold hover:text-black transition-colors">
                Email & Password
              </Link>
            </div>
          </div>

          {/* Hero graphic / Calendar picker mock (Right column) */}
          <div className="lg:col-span-6 flex justify-center relative animate-slideUp">
            
            {/* Bobbing abstract ornaments */}
            <div className="absolute top-10 left-10 w-16 h-16 border-4 border-yellow-400 rounded-full opacity-20 animate-float-circle pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-24 h-24 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-2xl rotate-12 opacity-10 pointer-events-none shadow-lg animate-float-shield" />

            {/* Premium mock widget container */}
            <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl relative z-10">
              <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
                <div className="h-10 w-10 rounded-full bg-blue-100 text-[#006bff] flex items-center justify-center font-bold text-sm">
                  C
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select a Date & Time</h4>
                  <p className="text-sm font-extrabold text-gray-900 mt-0.5">Callendly Demo Booking</p>
                </div>
              </div>

              {/* Monthly calendar picker mock layout */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-extrabold text-gray-700">
                  <span>August 2026</span>
                  <div className="flex gap-2">
                    <span className="text-gray-300 select-none">&lt;</span>
                    <span className="text-gray-600 select-none">&gt;</span>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-y-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>
                <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-bold text-gray-600">
                  <span className="text-gray-200">30</span><span className="text-gray-200">31</span>
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                  <span>6</span><span>7</span><span>8</span><span>9</span><span>10</span><span>11</span><span>12</span>
                  <span>13</span>
                  <span className="relative flex items-center justify-center">
                    <span className="absolute h-7 w-7 rounded-full bg-blue-50 text-[#006bff] flex items-center justify-center border border-[#006bff]/10 font-black">14</span>
                  </span>
                  <span className="relative flex items-center justify-center">
                    <span className="absolute h-7 w-7 rounded-full bg-blue-50 text-[#006bff] flex items-center justify-center border border-[#006bff]/10 font-black">15</span>
                  </span>
                  <span className="relative flex items-center justify-center">
                    <span className="absolute h-7 w-7 rounded-full bg-blue-50 text-[#006bff] flex items-center justify-center border border-[#006bff]/10 font-black">16</span>
                  </span>
                  <span>17</span><span>18</span><span>19</span><span>20</span><span>21</span><span>22</span><span>23</span>
                  <span>24</span><span>25</span><span>26</span><span>27</span><span>28</span><span>29</span><span>30</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BAR */}
        <section className="bg-gray-50/50 py-10 border-t border-b border-gray-100">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-6">
              Trusted by professionals and teams worldwide
            </span>
            <div className="flex flex-wrap items-center justify-center gap-10 opacity-40 font-black text-sm tracking-widest text-gray-500 uppercase">
              <span>Google</span>
              <span>Microsoft</span>
              <span>Slack</span>
              <span>Vercel</span>
              <span>Render</span>
              <span>Sarvam AI</span>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section id="features" className="mx-auto max-w-7xl px-6 py-24 sm:py-32 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-sm font-bold text-[#006bff] uppercase tracking-widest">How Callendly Works</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Callendly makes scheduling simple
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Eliminate back-and-forth emails. We manage your schedule automatically in three easy steps.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Create Simple Rules',
                desc: 'Let us know your available hours and meeting buffers. Customize rules easily during onboarding.',
                icon: Clock,
                color: 'bg-blue-50 text-[#006bff] border-blue-100'
              },
              {
                step: '02',
                title: 'Share Your Link',
                desc: 'Send your custom Callendly booking URL to invitees, embed it in emails, or post it on your bio.',
                icon: Globe,
                color: 'bg-green-50 text-green-600 border-green-100'
              },
              {
                step: '03',
                title: 'Get Booked Directly',
                desc: 'Invitees pick a time slot. We automatically confirm the meeting and write it to your calendars.',
                icon: Calendar,
                color: 'bg-purple-50 text-purple-600 border-purple-100'
              }
            ].map(item => (
              <div key={item.step} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                <div className="absolute top-4 right-4 text-3xl font-black text-gray-100 group-hover:text-blue-50 transition-colors">
                  {item.step}
                </div>
                <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-xl border ${item.color} shadow-inner`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-extrabold text-gray-900">{item.title}</h4>
                <p className="mt-3 text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* INTEGRATIONS GRID SECTION */}
        <section id="integrations" className="bg-[#fafbfe] py-24 sm:py-32 border-t border-b border-gray-100">
          <div className="mx-auto max-w-7xl px-6 grid gap-12 lg:grid-cols-12 items-center">
            
            {/* Text details (Left) */}
            <div className="lg:col-span-5 space-y-6">
              <h2 className="text-sm font-bold text-[#006bff] uppercase tracking-widest">Connect Integrations</h2>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
                Integrates with your favorite tools
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Connect your workspace directly to Google Calendar, Office 365, Zoom, Microsoft Teams, Slack, Stripe, PayPal, and more to coordinate schedules.
              </p>
              <div className="pt-4">
                <Link 
                  href="/signup" 
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006bff] hover:underline"
                >
                  Explore 20+ integrations <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* App Grid (Right) */}
            <div className="lg:col-span-7 grid grid-cols-3 sm:grid-cols-4 gap-4">
              {[
                { name: 'Google', desc: 'Calendar & Meet' },
                { name: 'Office 365', desc: 'Outlook & Teams' },
                { name: 'Zoom', desc: 'Video calls' },
                { name: 'Slack', desc: 'Chat alerts' },
                { name: 'Stripe', desc: 'Payments' },
                { name: 'PayPal', desc: 'Payments' },
                { name: 'HubSpot', desc: 'Sales CRM' },
                { name: 'Salesforce', desc: 'Enterprise CRM' },
                { name: 'Vercel', desc: 'Hosting' },
                { name: 'Prisma', desc: 'Database' },
                { name: 'Sarvam AI', desc: 'AI Assistant' },
                { name: 'Razorpay', desc: 'Gateway' }
              ].map(app => (
                <div key={app.name} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:scale-[1.03] transition-all text-center space-y-1 hover:shadow-md cursor-default">
                  <span className="h-8 w-8 bg-blue-50 text-[#006bff] rounded-lg font-black text-xs inline-flex items-center justify-center mb-1">
                    {app.name[0]}
                  </span>
                  <h4 className="font-extrabold text-xs text-gray-900">{app.name}</h4>
                  <p className="text-[9px] text-gray-400 font-semibold">{app.desc}</p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* PRICING PLANS SECTION */}
        <section id="pricing" className="mx-auto max-w-7xl px-6 py-24 sm:py-32 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-sm font-bold text-[#006bff] uppercase tracking-widest">Pricing Plans</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Pick the perfect plan for your team
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Start scheduling for free, then scale up as your team grows. Cancel or upgrade at any time.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            
            {/* Free Plan */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-extrabold text-sm text-gray-400 uppercase tracking-widest">Free</h4>
                  <p className="text-2xl font-black text-gray-900 mt-2">$0</p>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">Always free</p>
                </div>
                <div className="h-px bg-gray-100" />
                <ul className="space-y-2 text-xs text-gray-500 font-semibold">
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> 1 active event type</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Web page bookings</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Calendar conflict check</li>
                </ul>
              </div>
              <Link href="/signup" className="w-full text-center py-2.5 rounded-full border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                Sign up
              </Link>
            </div>

            {/* Standard Plan (Popular) */}
            <div className="rounded-2xl border-2 border-[#006bff] bg-white p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-3 right-3 text-[9px] font-black text-[#006bff] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider">
                Popular
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-extrabold text-sm text-gray-400 uppercase tracking-widest">Standard</h4>
                  <p className="text-2xl font-black text-gray-900 mt-2">$10</p>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">Per user / month</p>
                </div>
                <div className="h-px bg-gray-100" />
                <ul className="space-y-2 text-xs text-gray-500 font-semibold">
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Unlimited event types</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Calendar connection</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Custom buffers & times</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Automatic email alerts</li>
                </ul>
              </div>
              <Link href="/signup" className="w-full text-center py-2.5 rounded-full bg-[#006bff] text-xs font-bold text-white hover:bg-[#0052cc] transition-colors shadow-sm shadow-[#006bff]/20">
                Buy standard
              </Link>
            </div>

            {/* Teams Plan */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-extrabold text-sm text-gray-400 uppercase tracking-widest">Teams</h4>
                  <p className="text-2xl font-black text-gray-900 mt-2">$16</p>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">Per user / month</p>
                </div>
                <div className="h-px bg-gray-100" />
                <ul className="space-y-2 text-xs text-gray-500 font-semibold">
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Collective event scheduling</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Admin console rules</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Razorpay pay on booking</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Sarvam AI Meeting prep</li>
                </ul>
              </div>
              <Link href="/signup" className="w-full text-center py-2.5 rounded-full bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors">
                Get started
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-extrabold text-sm text-gray-400 uppercase tracking-widest">Enterprise</h4>
                  <p className="text-2xl font-black text-gray-900 mt-2">Custom</p>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">Tailored packages</p>
                </div>
                <div className="h-px bg-gray-100" />
                <ul className="space-y-2 text-xs text-gray-500 font-semibold">
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Custom branding</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Dedicated support</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Advanced SSO Security</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> SLA Guarantees</li>
                </ul>
              </div>
              <a href="mailto:sales@callendly.app" className="w-full text-center py-2.5 rounded-full border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                Contact sales
              </a>
            </div>

          </div>
        </section>

        {/* METRICS / STATS SECTION */}
        <section className="bg-gray-900 text-white py-24 relative overflow-hidden">
          {/* Abstract backdrop */}
          <div className="absolute top-[20%] left-[20%] w-[350px] h-[350px] rounded-full bg-blue-500/10 filter blur-3xl pointer-events-none" />
          
          <div className="mx-auto max-w-7xl px-6 grid gap-12 md:grid-cols-3 text-center relative z-10">
            <div className="space-y-2">
              <h3 className="text-5xl font-black text-[#006bff] tracking-tight">169%</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Return on Investment</p>
              <p className="text-[11px] text-gray-500">According to Forrester Forrester TEI Study</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-5xl font-black text-green-500 tracking-tight">160%</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">More Meetings Booked</p>
              <p className="text-[11px] text-gray-500">Coordinated schedules automatically</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-5xl font-black text-purple-500 tracking-tight">20%</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sales Team Conversion Increase</p>
              <p className="text-[11px] text-gray-500">Faster response time to new leads</p>
            </div>
          </div>
        </section>

        {/* SECURITY & TRUST SEALS */}
        <section className="mx-auto max-w-7xl px-6 py-20 text-center space-y-10 border-b border-gray-100">
          <div className="space-y-2.5 max-w-xl mx-auto">
            <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Built to keep your organization secure
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              We employ bank-grade security protocols, encryption at rest and in transit, and comply with international regulations to protect user privacy.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
              <Lock className="h-4 w-4 text-gray-400" /> SOC 2 Type II
            </div>
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
              <ShieldCheck className="h-4 w-4 text-green-600" /> GDPR Compliant
            </div>
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
              <Lock className="h-4 w-4 text-gray-400" /> CCPA Compliant
            </div>
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
              <ShieldCheck className="h-4 w-4 text-green-600" /> ISO 27001 Certified
            </div>
          </div>
        </section>

        {/* CALL TO ACTION SECTION */}
        <section className="mx-auto max-w-4xl px-6 py-20 text-center space-y-6">
          <h3 className="text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
            Power up your scheduling
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed max-w-lg mx-auto">
            Sign up for free and start sharing your customized booking link with invitees in seconds.
          </p>
          <div className="pt-4">
            <Link
              href="/signup"
              className="rounded-full bg-[#006bff] px-8 py-3.5 text-sm font-bold text-white hover:bg-[#0052cc] transition-all shadow-lg shadow-[#006bff]/20 inline-flex items-center gap-1.5"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-16 bg-[#fafbfe]">
        <div className="mx-auto max-w-7xl px-6 grid gap-8 grid-cols-2 md:grid-cols-5 text-xs text-gray-500">
          
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#006bff] text-white font-extrabold relative shadow-sm">
                <span>C</span>
              </div>
              <span className="text-base font-bold text-gray-900">
                Callendly<span className="text-[#006bff]">.</span>
              </span>
            </div>
            <p className="text-[11px] text-gray-400 max-w-xs leading-relaxed">
              Callendly is the modern, automated scheduling workspace built for professionals, sales agents, and collaborative teams.
            </p>
          </div>

          <div className="space-y-3">
            <h5 className="font-extrabold text-gray-900 uppercase tracking-widest text-[10px]">Product</h5>
            <ul className="space-y-2">
              <li><Link href="/signup" className="hover:text-black">Features</Link></li>
              <li><Link href="#pricing" className="hover:text-black">Pricing</Link></li>
              <li><Link href="#integrations" className="hover:text-black">Integrations</Link></li>
              <li><Link href="/login" className="hover:text-black">Log in</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h5 className="font-extrabold text-gray-900 uppercase tracking-widest text-[10px]">Solutions</h5>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-black">Sales Teams</a></li>
              <li><a href="#" className="hover:text-black">Marketing Leads</a></li>
              <li><a href="#" className="hover:text-black">Customer Success</a></li>
              <li><a href="#" className="hover:text-black">Education</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h5 className="font-extrabold text-gray-900 uppercase tracking-widest text-[10px]">Legal</h5>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-black">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-black">Terms of Service</a></li>
              <li><a href="#" className="hover:text-black">Security Overview</a></li>
            </ul>
          </div>

        </div>

        <div className="mx-auto max-w-7xl px-6 pt-12 mt-12 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
          <span>&copy; {new Date().getFullYear()} Callendly. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-black">Twitter</a>
            <a href="#" className="hover:text-black">LinkedIn</a>
            <a href="#" className="hover:text-black">GitHub</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
