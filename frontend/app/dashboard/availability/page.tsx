'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Rule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface DateOverride {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AvailabilityPage() {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'overrides'>('weekly');

  const [overrideForm, setOverrideForm] = useState({
    date: '',
    startTime: '09:00',
    endTime: '17:00',
    isActive: true
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    Promise.all([
      api.get('/availability'),
      api.get('/date-overrides')
    ]).then(([availRes, overrideRes]) => {
      const fetched = availRes.data.rules || [];
      if (fetched.length === 0) {
        const defaults = [1,2,3,4,5].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '17:00', isActive: true }));
        setRules(defaults);
      } else {
        setRules(fetched.map((r: any) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime, isActive: r.isActive })));
      }
      setOverrides(overrideRes.data.overrides || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  const updateRule = (index: number, key: keyof Rule, value: any) => {
    const next = [...rules];
    next[index] = { ...next[index], [key]: value };
    setRules(next);
  };

  const addRule = () => {
    setRules([...rules, { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }]);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const saveRules = async () => {
    setSaving(true);
    try {
      await api.post('/availability', { rules });
      alert('Availability saved!');
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideForm.date) return;
    try {
      const res = await api.post('/date-overrides', overrideForm);
      setOverrides([...overrides.filter(o => o.date !== overrideForm.date), res.data.override]);
      setOverrideForm({ date: '', startTime: '09:00', endTime: '17:00', isActive: true });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add date override');
    }
  };

  const handleDeleteOverride = async (id: string) => {
    if (!confirm('Remove this date override?')) return;
    try {
      await api.delete(`/date-overrides/${id}`);
      setOverrides(overrides.filter(o => o.id !== id));
    } catch {
      alert('Failed to delete override');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

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
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Availability</h1>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'weekly' ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Weekly Schedule
          </button>
          <button
            onClick={() => setActiveTab('overrides')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'overrides' ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Date Overrides
          </button>
        </div>

        {activeTab === 'weekly' && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500 mb-4">Set your recurring weekly availability. These hours apply every week unless overridden.</p>
            <div className="space-y-4">
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-3 flex-wrap">
                  <select
                    value={rule.dayOfWeek}
                    onChange={e => updateRule(idx, 'dayOfWeek', parseInt(e.target.value))}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <input
                    type="time"
                    value={rule.startTime}
                    onChange={e => updateRule(idx, 'startTime', e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="time"
                    value={rule.endTime}
                    onChange={e => updateRule(idx, 'endTime', e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={rule.isActive} onChange={e => updateRule(idx, 'isActive', e.target.checked)} />
                    Active
                  </label>
                  <button onClick={() => removeRule(idx)} className="text-sm text-red-600 hover:underline">Remove</button>
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={addRule} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Add Rule</button>
                <button onClick={saveRules} disabled={saving} className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'overrides' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-2">Add Date Override</h2>
              <p className="text-sm text-gray-500 mb-4">Override your weekly schedule for specific dates (holidays, extra hours, etc.).</p>
              <form onSubmit={handleAddOverride} className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-sm font-medium">Date</label>
                  <input
                    type="date"
                    required
                    value={overrideForm.date}
                    onChange={e => setOverrideForm({...overrideForm, date: e.target.value})}
                    className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Start</label>
                  <input
                    type="time"
                    required
                    value={overrideForm.startTime}
                    onChange={e => setOverrideForm({...overrideForm, startTime: e.target.value})}
                    className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">End</label>
                  <input
                    type="time"
                    required
                    value={overrideForm.endTime}
                    onChange={e => setOverrideForm({...overrideForm, endTime: e.target.value})}
                    className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <input
                    type="checkbox"
                    checked={overrideForm.isActive}
                    onChange={e => setOverrideForm({...overrideForm, isActive: e.target.checked})}
                    className="rounded border-gray-300 h-4 w-4"
                  />
                  <label className="text-sm">Available</label>
                </div>
                <button type="submit" className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800">
                  Add Override
                </button>
              </form>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Current Overrides</h2>
              {overrides.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No date overrides configured. Your weekly schedule applies to all dates.</p>
              ) : (
                <div className="space-y-3">
                  {overrides.map(o => (
                    <div key={o.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-sm font-medium">{o.date}</p>
                        <p className="text-xs text-gray-500">
                          {o.isActive ? `${o.startTime} - ${o.endTime}` : 'Unavailable (blocked)'}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteOverride(o.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
