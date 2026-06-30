'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

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
  isActive: boolean;
  bufferBefore: number;
  bufferAfter: number;
  minimumNotice: number;
  maximumBookingsPerDay: number | null;
  requiresConfirmation: boolean;
  requiresPayment?: boolean;
  price?: number;
  currency?: string;
  questions?: Question[];
}

const emptyForm = {
  title: '',
  slug: '',
  description: '',
  duration: 30,
  location: '',
  color: '#3b82f6',
  bufferBefore: 0,
  bufferAfter: 0,
  minimumNotice: 0,
  maximumBookingsPerDay: null as number | null,
  requiresConfirmation: false,
  requiresPayment: false,
  price: 0,
  currency: 'INR'
};

export default function EventTypesPage() {
  const router = useRouter();
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
  const [questionForm, setQuestionForm] = useState({
    label: '',
    type: 'text',
    required: false,
    options: '',
    order: 0
  });

  const fetchEventTypes = () => {
    api.get('/event-types').then(res => {
      setEventTypes(res.data.eventTypes);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchEventTypes();
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/event-types', form);
      setShowForm(false);
      setForm(emptyForm);
      fetchEventTypes();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create event type');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await api.put(`/event-types/${editingId}`, form);
      setEditingId(null);
      setForm(emptyForm);
      fetchEventTypes();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update event type');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/event-types/${id}`);
      setEventTypes(eventTypes.filter(et => et.id !== id));
      if (selectedEventType?.id === id) setSelectedEventType(null);
    } catch {
      alert('Failed to delete event type');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/event-types/${id}/duplicate`);
      fetchEventTypes();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to duplicate event type');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.put(`/event-types/${id}/toggle`);
      fetchEventTypes();
    } catch {
      alert('Failed to toggle event type');
    }
  };

  const startEdit = (et: EventType) => {
    setEditingId(et.id);
    setForm({
      title: et.title,
      slug: et.slug,
      description: et.description || '',
      duration: et.duration,
      location: et.location || '',
      color: et.color,
      bufferBefore: et.bufferBefore,
      bufferAfter: et.bufferAfter,
      minimumNotice: et.minimumNotice,
      maximumBookingsPerDay: et.maximumBookingsPerDay,
      requiresConfirmation: et.requiresConfirmation,
      requiresPayment: et.requiresPayment || false,
      price: et.price || 0,
      currency: et.currency || 'INR'
    });
    setShowForm(false);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventType) return;
    try {
      await api.post(`/event-types/${selectedEventType.id}/questions`, questionForm);
      setQuestionForm({ label: '', type: 'text', required: false, options: '', order: 0 });
      const res = await api.get('/event-types');
      setEventTypes(res.data.eventTypes);
      const updated = res.data.eventTypes.find((et: EventType) => et.id === selectedEventType.id);
      if (updated) setSelectedEventType(updated);
    } catch {
      alert('Failed to add question');
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!selectedEventType || !confirm('Delete this question?')) return;
    try {
      await api.delete(`/event-types/${selectedEventType.id}/questions/${qId}`);
      const res = await api.get('/event-types');
      setEventTypes(res.data.eventTypes);
      const updated = res.data.eventTypes.find((et: EventType) => et.id === selectedEventType.id);
      if (updated) setSelectedEventType(updated);
    } catch {
      alert('Failed to delete question');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading event types...</div>;

  const isFormVisible = showForm || editingId;

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
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }}
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            {isFormVisible ? 'Cancel' : 'New Event Type'}
          </button>
        </div>

        {isFormVisible && (
          <form onSubmit={editingId ? handleUpdate : handleCreate} className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">{editingId ? 'Edit Event Type' : 'Create Event Type'}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Title</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium">Slug</label>
                <input required value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} disabled={!!editingId} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none disabled:bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium">Duration (min)</label>
                <input type="number" required value={form.duration} onChange={e => setForm({ ...form, duration: parseInt(e.target.value) })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium">Location</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium">Color</label>
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-medium">Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" placeholder="Optional description" />
              </div>

              <div className="border-t border-gray-100 pt-4 sm:col-span-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Advanced Settings</h3>
              </div>
              <div>
                <label className="block text-sm font-medium">Buffer Before (min)</label>
                <input type="number" value={form.bufferBefore} onChange={e => setForm({ ...form, bufferBefore: parseInt(e.target.value) || 0 })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium">Buffer After (min)</label>
                <input type="number" value={form.bufferAfter} onChange={e => setForm({ ...form, bufferAfter: parseInt(e.target.value) || 0 })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium">Min Notice (hours)</label>
                <input type="number" value={form.minimumNotice} onChange={e => setForm({ ...form, minimumNotice: parseInt(e.target.value) || 0 })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium">Max Bookings/Day</label>
                <input type="number" value={form.maximumBookingsPerDay || ''} onChange={e => setForm({ ...form, maximumBookingsPerDay: e.target.value ? parseInt(e.target.value) : null })} placeholder="Unlimited" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="requiresConfirmation" checked={form.requiresConfirmation} onChange={e => setForm({ ...form, requiresConfirmation: e.target.checked })} className="rounded border-gray-300 text-black h-4 w-4" />
                <label htmlFor="requiresConfirmation" className="text-sm font-medium">Requires Confirmation</label>
                <span className="text-xs text-gray-400">(Host must approve)</span>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="requiresPayment" checked={form.requiresPayment} onChange={e => setForm({ ...form, requiresPayment: e.target.checked })} className="rounded border-gray-300 text-black h-4 w-4" />
                <label htmlFor="requiresPayment" className="text-sm font-medium">Requires Payment</label>
              </div>

              {form.requiresPayment && (
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  <div>
                    <label className="block text-sm font-medium">Price</label>
                    <input type="number" required value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Currency</label>
                    <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none">
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <button type="submit" className="mt-6 rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">
              {editingId ? 'Update Event Type' : 'Create Event Type'}
            </button>
          </form>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">Your Event Types</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {eventTypes.map(et => (
                <div key={et.id} className={`rounded-xl border bg-white p-5 shadow-sm transition-opacity ${et.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: et.color }} />
                      <h3 className="font-semibold">{et.title}</h3>
                    </div>
                    <span className={`text-xs ${et.isActive ? 'text-green-600' : 'text-gray-400'}`}>{et.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{et.duration} min {et.location && `| ${et.location}`}</p>

                  {(et.bufferBefore > 0 || et.bufferAfter > 0) && (
                    <p className="mt-1 text-xs text-gray-400">Buffer: {et.bufferBefore}min before, {et.bufferAfter}min after</p>
                  )}
                  {et.minimumNotice > 0 && (
                    <p className="mt-1 text-xs text-gray-400">Min notice: {et.minimumNotice}h</p>
                  )}
                  {et.maximumBookingsPerDay && (
                    <p className="mt-1 text-xs text-gray-400">Max {et.maximumBookingsPerDay}/day</p>
                  )}
                  {et.requiresConfirmation && (
                    <p className="mt-1 text-xs text-amber-600 font-medium">Requires confirmation</p>
                  )}

                  {et.requiresPayment && et.price && (
                    <p className="mt-1 text-sm font-medium text-green-600">
                      Paid: {et.currency || 'INR'} {et.price}
                    </p>
                  )}

                  {et.questions && et.questions.length > 0 && (
                    <p className="mt-1 text-xs text-gray-400">
                      Custom questions: {et.questions.length}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button onClick={() => handleToggle(et.id)} className="text-xs text-gray-600 hover:underline">
                      {et.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => startEdit(et)} className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => handleDuplicate(et.id)} className="text-xs text-purple-600 hover:underline">Duplicate</button>
                    <button onClick={() => setSelectedEventType(et)} className="text-xs text-blue-600 hover:underline">Questions</button>
                    <button onClick={() => handleDelete(et.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            {selectedEventType ? (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-6">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <h3 className="font-semibold text-gray-800">Questions: {selectedEventType.title}</h3>
                  <button onClick={() => setSelectedEventType(null)} className="text-xs text-gray-400 hover:text-black">Close</button>
                </div>

                <div className="space-y-3">
                  {(!selectedEventType.questions || selectedEventType.questions.length === 0) ? (
                    <p className="text-sm text-gray-500 italic">No custom questions added yet.</p>
                  ) : (
                    selectedEventType.questions.map(q => (
                      <div key={q.id} className="flex justify-between items-start bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{q.label} {q.required && <span className="text-red-500">*</span>}</p>
                          <p className="text-[10px] text-gray-500 capitalize">Type: {q.type}</p>
                          {q.type === 'select' && q.options && (
                            <p className="text-[10px] text-gray-400">Options: {q.options}</p>
                          )}
                        </div>
                        <button onClick={() => handleDeleteQuestion(q.id)} className="text-xs text-red-600 hover:underline pl-2">Delete</button>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddQuestion} className="border-t border-gray-100 pt-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add Custom Question</h4>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Question Label *</label>
                    <input type="text" required value={questionForm.label} onChange={e => setQuestionForm({...questionForm, label: e.target.value})} placeholder="e.g. What is your company name?" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-black focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Input Type</label>
                      <select value={questionForm.type} onChange={e => setQuestionForm({...questionForm, type: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-black focus:outline-none">
                        <option value="text">Short Text</option>
                        <option value="textarea">Long Text</option>
                        <option value="select">Dropdown Choice</option>
                        <option value="email">Email Address</option>
                        <option value="phone">Phone Number</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pl-1">
                      <input type="checkbox" id="qRequired" checked={questionForm.required} onChange={e => setQuestionForm({...questionForm, required: e.target.checked})} className="rounded border-gray-300 text-black h-4 w-4" />
                      <label htmlFor="qRequired" className="text-xs font-medium text-gray-700">Required</label>
                    </div>
                  </div>

                  {questionForm.type === 'select' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Options (comma-separated)</label>
                      <input type="text" required value={questionForm.options} onChange={e => setQuestionForm({...questionForm, options: e.target.value})} placeholder="Option A, Option B, Option C" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-black focus:outline-none" />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700">Display Order</label>
                    <input type="number" value={questionForm.order} onChange={e => setQuestionForm({...questionForm, order: parseInt(e.target.value) || 0})} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-black focus:outline-none" />
                  </div>

                  <button type="submit" className="w-full rounded-md bg-black py-2 text-xs text-white hover:bg-gray-800">Add Question</button>
                </form>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 bg-white shadow-sm">
                Select an event type to manage custom questions.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
