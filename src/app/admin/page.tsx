'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, Eye, FileText, LogOut, RefreshCw, Download, X, Sparkles, Plus, Pencil, Trash2, Video } from 'lucide-react';
import type { RecipientSummary, LandingPageTemplate } from '@/lib/types';

interface Stats {
  totalRecipients: number;
  pageVisits: number;
  video50Plus: number;
  ctaClicks: number;
}

interface RecipientsResponse {
  total: number;
  limit: number;
  offset: number;
  data: RecipientSummary[];
}

interface EditorRecipient {
  id: number;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  anrede: string | null;
  signal_category: string | null;
  signal_description: string | null;
  token: string;
}

const CONSULTING_INDUSTRIES = [
  'Management Consulting',
  'IT Consulting',
  'Strategy Consulting',
  'HR Consulting',
  'Financial Advisory',
  'Operations Consulting',
  'Interim Management',
  'Transformation',
];

const emptyTemplateForm = {
  name: '',
  industry: '',
  headline: '',
  subheadline: '',
  cta_button_text: '',
  body_html: '',
  vimeo_video_id: '',
  is_default: false,
};

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [storedPassword, setStoredPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'recipients' | 'templates'>('recipients');
  const [stats, setStats] = useState<Stats | null>(null);
  const [recipients, setRecipients] = useState<RecipientSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSignal, setFilterSignal] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;

  // Letter Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editorRecipient, setEditorRecipient] = useState<EditorRecipient | null>(null);
  const [editorLetterHtml, setEditorLetterHtml] = useState('');
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorGenerating, setEditorGenerating] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<LandingPageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LandingPageTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [templateSaving, setTemplateSaving] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredPassword(password);
    setIsLoggedIn(true);
    setPassword('');
    loadDashboardWithPassword(password);
  };

  const getAuthHeader = () => `Bearer ${storedPassword}`;

  const loadDashboardWithPassword = async (pw?: string) => {
    const authHeader = `Bearer ${pw || storedPassword}`;
    setLoading(true);
    setError(null);

    try {
      const statsResponse = await fetch('/api/admin/stats', {
        headers: { Authorization: authHeader },
      });

      if (statsResponse.status === 401) throw new Error('AUTH_FAILED');
      if (!statsResponse.ok) {
        const errData = await statsResponse.json().catch(() => ({}));
        throw new Error(`Stats failed: ${errData.error || statsResponse.statusText}`);
      }
      setStats(await statsResponse.json());

      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      if (filterStatus) params.append('status', filterStatus);
      if (filterSignal) params.append('signal', filterSignal);

      const recipientsResponse = await fetch(`/api/admin/recipients?${params}`, {
        headers: { Authorization: authHeader },
      });

      if (recipientsResponse.status === 401) throw new Error('AUTH_FAILED');
      if (!recipientsResponse.ok) throw new Error('Failed to load recipients');

      const recipientsData: RecipientsResponse = await recipientsResponse.json();
      setRecipients(recipientsData.data);
      setTotal(recipientsData.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'AUTH_FAILED') {
        setIsLoggedIn(false);
        setStoredPassword('');
        setError('Invalid password');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = () => loadDashboardWithPassword();

  // ── Templates ──────────────────────────────────────────────────
  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const response = await fetch('/api/admin/templates', {
        headers: { Authorization: getAuthHeader() },
      });
      if (!response.ok) throw new Error('Failed to load templates');
      const data = await response.json();
      setTemplates(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleOpenTemplateModal = (template?: LandingPageTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        industry: template.industry || '',
        headline: template.headline || '',
        subheadline: template.subheadline || '',
        cta_button_text: template.cta_button_text || '',
        body_html: template.body_html || '',
        vimeo_video_id: template.vimeo_video_id || '',
        is_default: template.is_default || false,
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm(emptyTemplateForm);
    }
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) { alert('Name is required'); return; }
    setTemplateSaving(true);
    try {
      const url = editingTemplate ? `/api/admin/templates/${editingTemplate.id}` : '/api/admin/templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save template');
      }
      setShowTemplateModal(false);
      await loadTemplates();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    try {
      const response = await fetch(`/api/admin/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: getAuthHeader() },
      });
      if (!response.ok) throw new Error('Failed to delete template');
      await loadTemplates();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // ── Recipients / Letter ────────────────────────────────────────
  const handleSync = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/sync', { method: 'POST', headers: { Authorization: getAuthHeader() } });
      if (!response.ok) throw new Error('Sync failed');
      alert(`Sync successful: ${(await response.json()).message}`);
      await loadDashboard();
    } catch (err) { setError(err instanceof Error ? err.message : 'Sync failed'); }
    finally { setLoading(false); }
  };

  const handlePush = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/push', { method: 'POST', headers: { Authorization: getAuthHeader() } });
      if (!response.ok) throw new Error('Push failed');
      alert(`Push successful: ${(await response.json()).message}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Push failed'); }
    finally { setLoading(false); }
  };

  const handleOpenEditor = async (recipientId: number) => {
    setEditorLoading(true); setShowEditor(true); setEditorRecipient(null); setEditorLetterHtml('');
    try {
      const response = await fetch(`/api/letter/${recipientId}/preview`, {
        method: 'POST', headers: { Authorization: getAuthHeader() },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load preview');
      }
      const data = await response.json();
      setEditorRecipient(data.recipient);
      setEditorLetterHtml(data.letterHtml);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setShowEditor(false);
    } finally { setEditorLoading(false); }
  };

  const handleRegenerateLetter = async () => {
    if (!editorRecipient) return;
    setEditorLoading(true);
    try {
      const response = await fetch(`/api/letter/${editorRecipient.id}/preview`, {
        method: 'POST', headers: { Authorization: getAuthHeader() },
      });
      if (!response.ok) throw new Error('Failed to regenerate letter');
      setEditorLetterHtml((await response.json()).letterHtml);
    } catch (err) { alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setEditorLoading(false); }
  };

  const handleGeneratePdf = async () => {
    if (!editorRecipient) return;
    setEditorGenerating(true);
    try {
      const response = await fetch(`/api/letter/${editorRecipient.id}`, {
        method: 'POST',
        headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ letterHtml: editorLetterHtml }),
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      const url = window.URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${editorRecipient.last_name || 'Unknown'}_${editorRecipient.company || 'Company'}_${editorRecipient.token}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      await loadDashboard();
    } catch (err) { alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setEditorGenerating(false); }
  };

  const handleBatchDownload = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/batch-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: getAuthHeader() },
        body: JSON.stringify({ status: filterStatus || undefined, signal_category: filterSignal || undefined, personalize: true }),
      });
      if (!response.ok) throw new Error('Failed to generate batch letters');
      const url = window.URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `asksopia-letters-${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to download batch'); }
    finally { setLoading(false); }
  };

  const handleFilterChange = () => { setOffset(0); loadDashboard(); };

  // ── Login ──────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-2xl p-8">
            <h1 className="text-3xl font-bold text-center mb-2" style={{ color: '#1a1a2e' }}>askSOPia</h1>
            <p className="text-center text-gray-600 mb-8">Admin Dashboard</p>
            <form onSubmit={handleLogin}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter admin password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition">
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Dashboard ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold" style={{ color: '#1a1a2e' }}>Dashboard</h1>
          <button
            onClick={() => { setIsLoggedIn(false); setStoredPassword(''); setStats(null); setRecipients([]); }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
          >
            <LogOut size={20} />Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-gray-200 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('recipients')}
            className={`px-5 py-2 text-sm font-medium rounded-md transition ${activeTab === 'recipients' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Recipients
          </button>
          <button
            onClick={() => { setActiveTab('templates'); loadTemplates(); }}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md transition ${activeTab === 'templates' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Video size={15} />Landing Templates
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 items-start">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* ── RECIPIENTS TAB ── */}
        {activeTab === 'recipients' && (
          <>
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {[
                  { label: 'Total Recipients', value: stats.totalRecipients, color: '#3b82f6' },
                  { label: 'Page Visits', value: stats.pageVisits, color: '#3b82f6' },
                  { label: 'Video 50%+', value: stats.video50Plus, color: '#10b981' },
                  { label: 'CTA Clicks', value: stats.ctaClicks, color: '#8b5cf6' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderColor: color }}>
                    <p className="text-gray-600 text-sm font-medium">{label}</p>
                    <p className="text-4xl font-bold mt-2" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mb-8">
              <button onClick={async () => { setLoading(true); await loadDashboard(); }} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition disabled:opacity-50">
                <RefreshCw size={20} />Refresh
              </button>
              <button onClick={handleSync} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition disabled:opacity-50">
                <CheckCircle size={20} />Sync from ClickUp
              </button>
              <button onClick={handlePush} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition disabled:opacity-50">
                <CheckCircle size={20} />Push to ClickUp
              </button>
              <button onClick={handleBatchDownload} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition disabled:opacity-50">
                <Download size={20} />Download Letters (ZIP)
              </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4" style={{ color: '#1a1a2e' }}>Filters</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setTimeout(handleFilterChange, 0); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">All Statuses</option>
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="cold">Cold</option>
                    <option value="no_interest">No Interest</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Signal Category</label>
                  <input type="text" value={filterSignal}
                    onChange={(e) => { setFilterSignal(e.target.value); setTimeout(handleFilterChange, 0); }}
                    placeholder="Filter by signal..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead style={{ backgroundColor: '#1a1a2e' }}>
                    <tr>
                      {['Name', 'Company', 'Industry', 'Signal', 'Status', 'Video %', 'Visits', 'Last Activity', 'Actions'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-sm font-semibold text-white">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r) => (
                      <tr key={r.id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm">{r.first_name} {r.last_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{r.company || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{r.industry || <span className="text-gray-300">—</span>}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{r.signal_category || '-'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            r.status === 'hot' ? 'bg-red-100 text-red-800' :
                            r.status === 'warm' ? 'bg-yellow-100 text-yellow-800' :
                            r.status === 'no_interest' ? 'bg-gray-100 text-gray-800' :
                            'bg-blue-100 text-blue-800'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">{Math.round(r.max_video_percent * 100)}%</td>
                        <td className="px-6 py-4 text-sm">{r.page_visits}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {r.last_activity ? new Date(r.last_activity).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm flex gap-2">
                          <button onClick={() => handleOpenEditor(r.id)} title="Edit & Generate Letter"
                            className="p-1 hover:bg-gray-200 rounded transition">
                            <FileText size={18} className="text-blue-500" />
                          </button>
                          <button onClick={() => window.open(`/r/${r.token}`, '_blank')} title="View landing page"
                            className="p-1 hover:bg-gray-200 rounded transition">
                            <Eye size={18} className="text-green-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Showing {offset + 1}–{Math.min(offset + limit, total)} of {total} recipients
                </p>
                <div className="flex gap-2">
                  <button onClick={() => { setOffset(Math.max(0, offset - limit)); loadDashboard(); }}
                    disabled={offset === 0}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition">
                    Previous
                  </button>
                  <button onClick={() => { setOffset(offset + limit); loadDashboard(); }}
                    disabled={offset + limit >= total}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition">
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── TEMPLATES TAB ── */}
        {activeTab === 'templates' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#1a1a2e' }}>Landing Page Templates</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Configure Vimeo videos and page content per industry. Recipients are matched by their industry field.
                </p>
              </div>
              <button onClick={() => handleOpenTemplateModal()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition">
                <Plus size={18} />New Template
              </button>
            </div>

            {templatesLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : templates.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Video size={40} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No templates yet. Create one to get started.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead style={{ backgroundColor: '#1a1a2e' }}>
                    <tr>
                      {['Name', 'Industry', 'Vimeo Video ID', 'Headline', 'Default', 'Actions'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-sm font-semibold text-white">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium">{t.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{t.industry || <span className="text-gray-400 italic">any</span>}</td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-600">{t.vimeo_video_id || <span className="text-gray-400">—</span>}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{t.headline || <span className="text-gray-400">—</span>}</td>
                        <td className="px-6 py-4 text-sm">
                          {t.is_default && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Default</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm flex gap-2">
                          <button onClick={() => handleOpenTemplateModal(t)} title="Edit"
                            className="p-1 hover:bg-gray-200 rounded transition">
                            <Pencil size={16} className="text-blue-500" />
                          </button>
                          <button onClick={() => handleDeleteTemplate(t.id)} title="Delete"
                            className="p-1 hover:bg-gray-200 rounded transition">
                            <Trash2 size={16} className="text-red-400" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── LETTER EDITOR MODAL ── */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl z-10">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#1a1a2e' }}>Letter Editor</h2>
                {editorRecipient && (
                  <p className="text-sm text-gray-500">{editorRecipient.first_name} {editorRecipient.last_name} — {editorRecipient.company}</p>
                )}
              </div>
              <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {editorLoading && !editorRecipient ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                  <span className="ml-3 text-gray-600">Claude is writing the letter...</span>
                </div>
              ) : editorRecipient ? (
                <>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Address</h3>
                    <p className="text-sm text-gray-700">{editorRecipient.first_name} {editorRecipient.last_name}</p>
                    {editorRecipient.company && <p className="text-sm text-gray-700">{editorRecipient.company}</p>}
                    {editorRecipient.street && <p className="text-sm text-gray-700">{editorRecipient.street}</p>}
                    <p className="text-sm text-gray-700">
                      {[editorRecipient.postal_code, editorRecipient.city].filter(Boolean).join(' ')}
                      {editorRecipient.country && !['Deutschland', 'Germany'].includes(editorRecipient.country) ? `, ${editorRecipient.country}` : ''}
                    </p>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Signal</h3>
                    <p className="text-sm font-medium text-blue-800">{editorRecipient.signal_category || 'No category'}</p>
                    {editorRecipient.signal_description && (
                      <p className="text-sm text-blue-700 mt-1">{editorRecipient.signal_description}</p>
                    )}
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-3">
                    <p className="text-xs text-yellow-700">
                      <strong>Note:</strong> The greeting (e.g. &quot;Lieber Rainer,&quot;) is added manually to the printed letter. The text below starts right after the greeting.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-semibold text-gray-700">Letter Content (HTML)</label>
                      <button onClick={handleRegenerateLetter} disabled={editorLoading}
                        className="flex items-center gap-1 text-xs px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-full transition disabled:opacity-50">
                        <Sparkles size={14} />
                        {editorLoading ? 'Generating...' : 'Regenerate with Claude'}
                      </button>
                    </div>
                    <textarea
                      value={editorLetterHtml}
                      onChange={(e) => setEditorLetterHtml(e.target.value)}
                      rows={20}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono leading-relaxed"
                      placeholder="Claude-generated letter will appear here..."
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Uses HTML tags. The QR code appears where {'{{qr_code}}'} is written.
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            {editorRecipient && (
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white rounded-b-xl">
                <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                  Cancel
                </button>
                <button onClick={handleGeneratePdf} disabled={editorGenerating || !editorLetterHtml}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition disabled:opacity-50">
                  <Download size={18} />
                  {editorGenerating ? 'Generating PDF...' : 'Generate PDF'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TEMPLATE EDITOR MODAL ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl z-10">
              <h2 className="text-xl font-bold" style={{ color: '#1a1a2e' }}>
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h2>
              <button onClick={() => setShowTemplateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={templateForm.name}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. IT-Dienstleister, Steuerberater, Default"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Industry</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {CONSULTING_INDUSTRIES.map((ind) => {
                    const selected = templateForm.industry
                      .split(',')
                      .map((s) => s.trim().toLowerCase())
                      .includes(ind.toLowerCase());
                    return (
                      <button
                        key={ind}
                        type="button"
                        onClick={() => {
                          const current = templateForm.industry
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean);
                          const next = selected
                            ? current.filter((s) => s.toLowerCase() !== ind.toLowerCase())
                            : [...current, ind];
                          setTemplateForm((f) => ({ ...f, industry: next.join(',') }));
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                          selected
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                        }`}
                      >
                        {ind}
                      </button>
                    );
                  })}
                </div>
                <input type="text" value={templateForm.industry}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, industry: e.target.value }))}
                  placeholder="Custom values, comma-separated (or use chips above)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                <p className="text-xs text-gray-400 mt-1">
                  Click chips to select industries, or type custom values. Leave empty + enable default for the fallback template.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Vimeo Video ID</label>
                <input type="text" value={templateForm.vimeo_video_id}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, vimeo_video_id: e.target.value }))}
                  placeholder="e.g. 123456789"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono" />
                <p className="text-xs text-gray-400 mt-1">
                  The numeric ID from the Vimeo URL: vimeo.com/<strong>123456789</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Headline</label>
                <input type="text" value={templateForm.headline}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, headline: e.target.value }))}
                  placeholder="Leave empty for auto 'Hallo Herr/Frau [LastName]' greeting"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                <p className="text-xs text-gray-400 mt-1">
                  Placeholders: {'{{first_name}}'} {'{{last_name}}'} {'{{company}}'} {'{{anrede}}'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Subheadline</label>
                <input type="text" value={templateForm.subheadline}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, subheadline: e.target.value }))}
                  placeholder="e.g. Entdecken Sie, wie askSOPia Ihre Kanzlei effizienter macht."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">CTA Button Text</label>
                <input type="text" value={templateForm.cta_button_text}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, cta_button_text: e.target.value }))}
                  placeholder="e.g. Termin vereinbaren"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Body HTML <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea value={templateForm.body_html}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, body_html: e.target.value }))}
                  rows={5}
                  placeholder="<p>Additional content shown below the video...</p>"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono" />
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_default" checked={templateForm.is_default}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, is_default: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="is_default" className="text-sm font-medium text-gray-700">
                  Use as default template (fallback for recipients without a matching industry)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white rounded-b-xl">
              <button onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                Cancel
              </button>
              <button onClick={handleSaveTemplate} disabled={templateSaving}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition disabled:opacity-50">
                {templateSaving ? 'Saving...' : editingTemplate ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
