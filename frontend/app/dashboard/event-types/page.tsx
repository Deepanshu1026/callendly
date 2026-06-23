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
  requiresPayment?: boolean;
  price?: number;
  currency?: string;
  questions?: Question[];
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
    minimumNotice: 0,
    requiresPayment: false,
    price: 0,
    currency: 'INR'
  });

  // Questions Manager state
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
      const res = await api.post('/event-types', form);
      setEventTypes([res.data.eventType, ...eventTypes]);
      setShowForm(false);
      setForm({
        title: '',
        slug: '',
        description: '',
        duration: 30,
        location: '',
        color: '#3b82f6',
        bufferBefore: 0,
        bufferAfter: 0,
        minimumNotice: 0,
        requiresPayment: false,
        price: 0,
        currency: 'INR'
      });
      fetchEventTypes();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create event type');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/event-types/${id}`);
      setEventTypes(eventTypes.filter(et => et.id !== id));
      if (selectedEventType?.id === id) {
        setSelectedEventType(null);
      }
    } catch {
      alert('Failed to delete event type');
    }
  };

  // Question Management Actions
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventType) return;
    try {
      await api.post(`/event-types/${selectedEventType.id}/questions`, questionForm);
      setQuestionForm({
        label: '',
        type: 'text',
        required: false,
        options: '',
        order: 0
      });
      // Refetch
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
      // Refetch
      const res = await api.get('/event-types');
      setEventTypes(res.data.eventTypes);
      const updated = res.data.eventTypes.find((et: EventType) => et.id === selectedEventType.id);
      if (updated) setSelectedEventType(updated);
    } catch {
      alert('Failed to delete question');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading event types...</div>;

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
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium">Slug</label>
                <input required value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
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
                <label className="block text-sm font-medium">Min Notice (hours)</label>
                <input type="number" value={form.minimumNotice} onChange={e => setForm({ ...form, minimumNotice: parseInt(e.target.value) })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
              </div>

              {/* Payment Section */}
              <div className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  id="requiresPayment"
                  checked={form.requiresPayment}
                  onChange={e => setForm({ ...form, requiresPayment: e.target.checked })}
                  className="rounded border-gray-300 text-black focus:ring-black h-4 w-4"
                />
                <label htmlFor="requiresPayment" className="text-sm font-medium">Requires Payment</label>
              </div>

              {form.requiresPayment && (
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  <div>
                    <label className="block text-sm font-medium">Price</label>
                    <input
                      type="number"
                      required
                      value={form.price}
                      onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Currency</label>
                    <select
                      value={form.currency}
                      onChange={e => setForm({ ...form, currency: e.target.value })}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none animate-none"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <button type="submit" className="mt-6 rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">Create Event Type</button>
          </form>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">Your Event Types</h2>
            <div className="grid gap-4 sm:grid-cols-2">
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

                  <div className="mt-4 flex gap-4">
                    <button
                      onClick={() => setSelectedEventType(et)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Manage Questions
                    </button>
                    <button onClick={() => handleDelete(et.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Custom Question Manager for selected event type */}
          <div>
            {selectedEventType ? (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-6">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <h3 className="font-semibold text-gray-800">Questions: {selectedEventType.title}</h3>
                  <button onClick={() => setSelectedEventType(null)} className="text-xs text-gray-400 hover:text-black">Close</button>
                </div>

                {/* List Questions */}
                <div className="space-y-3">
                  {(!selectedEventType.questions || selectedEventType.questions.length === 0) ? (
                    <p className="text-sm text-gray-500 italic">No custom questions added yet. Guests will only be asked for Name, Email, Phone, and Notes.</p>
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

                {/* Add Question Form */}
                <form onSubmit={handleAddQuestion} className="border-t border-gray-100 pt-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add Custom Question</h4>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Question Label *</label>
                    <input
                      type="text"
                      required
                      value={questionForm.label}
                      onChange={e => setQuestionForm({ ...questionForm, label: e.target.value })}
                      placeholder="e.g. What is your company name?"
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-black focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Input Type</label>
                      <select
                        value={questionForm.type}
                        onChange={e => setQuestionForm({ ...questionForm, type: e.target.value })}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-black focus:outline-none animate-none"
                      >
                        <option value="text">Short Text</option>
                        <option value="textarea">Long Text</option>
                        <option value="select">Dropdown Choice</option>
                        <option value="email">Email Address</option>
                        <option value="phone">Phone Number</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pl-1">
                      <input
                        type="checkbox"
                        id="qRequired"
                        checked={questionForm.required}
                        onChange={e => setQuestionForm({ ...questionForm, required: e.target.checked })}
                        className="rounded border-gray-300 text-black focus:ring-black h-4 w-4"
                      />
                      <label htmlFor="qRequired" className="text-xs font-medium text-gray-700">Required</label>
                    </div>
                  </div>

                  {questionForm.type === 'select' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Options (comma-separated)</label>
                      <input
                        type="text"
                        required
                        value={questionForm.options}
                        onChange={e => setQuestionForm({ ...questionForm, options: e.target.value })}
                        placeholder="Option A, Option B, Option C"
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-black focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700">Display Order</label>
                    <input
                      type="number"
                      value={questionForm.order}
                      onChange={e => setQuestionForm({ ...questionForm, order: parseInt(e.target.value) || 0 })}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-black focus:outline-none"
                    />
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

