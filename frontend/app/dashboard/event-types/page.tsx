'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration: number;
  location: string | null;
  color: string;
  isActive: boolean;
  bufferBefore: number;
  bufferAfter: number;
  minimumNotice: number;
}

export default function EventTypesPage() {
  const router = useRouter();
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    duration: 30,
    location: '',
    color: '#3b82f6',
    bufferBefore: 0,
    bufferAfter: 0,
    minimumNotice: 0
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    api.get('/event-types').then(res => {
      setEventTypes(res.data.eventTypes);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/event-types', form);
      setEventTypes([res.data.eventType, ...eventTypes]);
      setShowForm(false);
      setForm({ title: '', slug: '', description: '', duration: 30, location: '', color: '#3b82f6', bufferBefore: 0, bufferAfter: 0, minimumNotice: 0 });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create event type');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    await api.delete(`/event-types/${id}`);
    setEventTypes(eventTypes.filter(et => et.id !== id));
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
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Event Types</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            {showForm ? 'Cancel' : 'New Event Type'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Title</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium">Slug</label>
                <input required value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium">Duration (min)</label>
                <input type="number" required value={form.duration} onChange={e => setForm({ ...form, duration: parseInt(e.target.value) })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium">Location</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium">Color</label>
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-medium">Min Notice (hours)</label>
                <input type="number" value={form.minimumNotice} onChange={e => setForm({ ...form, minimumNotice: parseInt(e.target.value) })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <button type="submit" className="mt-4 rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">Create</button>
          </form>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventTypes.map(et => (
            <div key={et.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: et.color }} />
                  <h3 className="font-semibold">{et.title}</h3>
                </div>
                <span className={`text-xs ${et.isActive ? 'text-green-600' : 'text-gray-400'}`}>{et.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{et.duration} min {et.location && `| ${et.location}`}</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => handleDelete(et.id)} className="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
