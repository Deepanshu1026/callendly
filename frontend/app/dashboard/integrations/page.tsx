'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Webhook {
  id: string;
  url: string;
  events: string;
  isActive: boolean;
}

interface Integration {
  id: string;
  type: string;
  config: any;
  isActive: boolean;
}

export default function IntegrationsPage() {
  const router = useRouter();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Forms state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpaySecret, setRazorpaySecret] = useState('');
  const [sarvamKey, setSarvamKey] = useState('');
  const [slackUrl, setSlackUrl] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    
    Promise.all([
      api.get('/webhooks'),
      api.get('/integrations')
    ]).then(([webhooksRes, integrationsRes]) => {
      setWebhooks(webhooksRes.data.webhooks);
      const integrationsList: Integration[] = integrationsRes.data.integrations;
      setIntegrations(integrationsList);
      
      // Populate keys if already configured
      const rzp = integrationsList.find(i => i.type === 'razorpay');
      if (rzp) {
        setRazorpayKeyId(rzp.config?.keyId || '');
        setRazorpaySecret(rzp.config?.keySecret || '');
      }
      
      const sarvam = integrationsList.find(i => i.type === 'sarvam');
      if (sarvam) {
        setSarvamKey(sarvam.config?.apiKey || '');
      }

      const slack = integrationsList.find(i => i.type === 'slack');
      if (slack) {
        setSlackUrl(slack.config?.webhookUrl || '');
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  const handleSaveRazorpay = async () => {
    try {
      await api.post('/integrations', {
        type: 'razorpay',
        config: { keyId: razorpayKeyId, keySecret: razorpaySecret }
      });
      alert('Razorpay credentials updated successfully.');
    } catch {
      alert('Failed to update Razorpay credentials.');
    }
  };

  const handleSaveSarvam = async () => {
    try {
      await api.post('/integrations', {
        type: 'sarvam',
        config: { apiKey: sarvamKey }
      });
      alert('Sarvam AI credentials updated successfully.');
    } catch {
      alert('Failed to update Sarvam AI credentials.');
    }
  };

  const handleSaveSlack = async () => {
    try {
      await api.post('/integrations', {
        type: 'slack',
        config: { webhookUrl: slackUrl }
      });
      alert('Slack notifications webhook updated.');
    } catch {
      alert('Failed to update Slack webhook.');
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/webhooks', { url: webhookUrl });
      setWebhooks([res.data.webhook, ...webhooks]);
      setWebhookUrl('');
    } catch {
      alert('Failed to create webhook.');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
      await api.delete(`/webhooks/${id}`);
      setWebhooks(webhooks.filter(w => w.id !== id));
    } catch {
      alert('Failed to delete webhook.');
    }
  };

  if (loading) return <div className="p-8">Loading integrations...</div>;

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

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold">Integrations</h1>

        <div className="space-y-6">
          {/* Razorpay Section */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Razorpay Payments Gateway</h2>
            <p className="text-sm text-gray-500 mb-4">Accept payments for paid bookings and scheduling consultations directly from customers.</p>
            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Razorpay Key ID</label>
                <input
                  type="text"
                  value={razorpayKeyId}
                  onChange={e => setRazorpayKeyId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  placeholder="rzp_test_..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Razorpay Secret Key</label>
                <input
                  type="password"
                  value={razorpaySecret}
                  onChange={e => setRazorpaySecret(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  placeholder="••••••••••••"
                />
              </div>
            </div>
            <button onClick={handleSaveRazorpay} className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">
              Save Razorpay Config
            </button>
          </div>

          {/* Sarvam AI Section */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Sarvam AI Assistant</h2>
            <p className="text-sm text-gray-500 mb-4">Enable AI-powered scheduling recommendations, booking prep notes, and meeting summaries.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Sarvam API Key</label>
              <input
                type="password"
                value={sarvamKey}
                onChange={e => setSarvamKey(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                placeholder="sk_..."
              />
            </div>
            <button onClick={handleSaveSarvam} className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">
              Save Sarvam AI Config
            </button>
          </div>

          {/* Slack Section */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Slack Alerts</h2>
            <p className="text-sm text-gray-500 mb-4">Send instant notifications to a Slack channel when bookings are created or rescheduled.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Slack Webhook URL</label>
              <input
                type="text"
                value={slackUrl}
                onChange={e => setSlackUrl(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>
            <button onClick={handleSaveSlack} className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">
              Save Slack Config
            </button>
          </div>

          {/* Webhooks Section */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Webhooks</h2>
            <p className="text-sm text-gray-500 mb-4">Deliver real-time POST payloads to external API endpoints when scheduling events occur.</p>
            
            <form onSubmit={handleCreateWebhook} className="flex gap-2 mb-6">
              <input
                type="url"
                required
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://api.yourdomain.com/webhooks"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
              <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 whitespace-nowrap">
                Add Endpoint
              </button>
            </form>

            <div className="divide-y divide-gray-100">
              {webhooks.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No webhook endpoints registered yet.</p>
              ) : (
                webhooks.map(w => (
                  <div key={w.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-mono text-xs text-gray-800 break-all">{w.url}</p>
                      <p className="text-[10px] text-gray-400 capitalize">Events: {w.events}</p>
                    </div>
                    <button onClick={() => handleDeleteWebhook(w.id)} className="text-xs text-red-600 hover:underline pl-4">
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
