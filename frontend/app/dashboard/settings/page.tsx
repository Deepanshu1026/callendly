'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    username: '',
    bio: '',
    timezone: 'UTC',
    language: 'en',
    publicBookingPage: true,
    avatar: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    api.get('/auth/me').then(res => {
      const u = res.data.user;
      setUser(u);
      const p = u.profile || {};
      setProfile(p);
      setForm({
        name: u.name || '',
        username: p.username || '',
        bio: p.bio || '',
        timezone: p.timezone || 'UTC',
        language: p.language || 'en',
        publicBookingPage: p.publicBookingPage ?? true,
        avatar: u.avatar || ''
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.put('/profile', form);
      setMessage('Profile updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage('Password changed successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading settings...</div>;

  const TIMEZONES = [
    'UTC', 'Asia/Calcutta', 'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo',
    'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland'
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold">Callendly</Link>
          <div className="flex gap-2">
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-black">Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold">Settings</h1>

        {message && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>}
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {/* Profile Section */}
        <form onSubmit={handleSaveProfile} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold border-b border-gray-100 pb-3">Profile</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Full Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium">Username</label>
              <div className="mt-1 flex rounded-md border border-gray-300 overflow-hidden">
                <span className="bg-gray-50 px-3 py-2 text-xs text-gray-500 flex items-center border-r border-gray-300">callendly.app/</span>
                <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="flex-1 px-3 py-2 text-sm focus:outline-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Bio</label>
            <textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" placeholder="Tell people about yourself" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Timezone</label>
              <select value={form.timezone} onChange={e => setForm({...form, timezone: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none">
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Language</label>
              <select value={form.language} onChange={e => setForm({...form, language: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none">
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="publicPage" checked={form.publicBookingPage} onChange={e => setForm({...form, publicBookingPage: e.target.checked})} className="rounded border-gray-300 text-black h-4 w-4" />
            <label htmlFor="publicPage" className="text-sm font-medium">Public booking page</label>
          </div>

          <button type="submit" disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        {/* Password Change Section */}
        <form onSubmit={handlePasswordChange} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold border-b border-gray-100 pb-3">Change Password</h2>
          {user?.hasPassword ? (
            <>
              <div>
                <label className="block text-sm font-medium">Current Password</label>
                <input type="password" required value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">New Password</label>
                  <input type="password" required minLength={6} value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Confirm New Password</label>
                  <input type="password" required minLength={6} value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
                </div>
              </div>
              <button type="submit" disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50">
                {saving ? 'Changing...' : 'Change Password'}
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">You signed in with Google. <Link href="/forgot-password" className="text-black font-medium hover:underline">Set a password</Link> to enable password login.</p>
          )}
        </form>
      </main>
    </div>
  );
}
