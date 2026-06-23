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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AvailabilityPage() {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    api.get('/availability').then(res => {
      const fetched = res.data.rules || [];
      if (fetched.length === 0) {
        // Default availability: Mon-Fri 9-5
        const defaults = [1,2,3,4,5].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '17:00', isActive: true }));
        setRules(defaults);
      } else {
        setRules(fetched.map((r: any) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime, isActive: r.isActive })));
      }
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

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/availability', { rules });
      alert('Availability saved!');
    } catch (err) {
      alert('Failed to save');
    } finally {
      setSaving(false);
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
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {rules.map((rule, idx) => (
            <div key={idx} className="flex items-center gap-3">
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
                <input
                  type="checkbox"
                  checked={rule.isActive}
                  onChange={e => updateRule(idx, 'isActive', e.target.checked)}
                />
                Active
              </label>
              <button onClick={() => removeRule(idx)} className="text-sm text-red-600 hover:underline">Remove</button>
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={addRule} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Add Rule</button>
            <button onClick={save} disabled={saving} className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </main>
    </div>
  );
}
