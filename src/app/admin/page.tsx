'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Eye, FileText, LogOut, RefreshCw, Download } from 'lucide-react';
import type { RecipientSummary } from '@/lib/types';

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

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [storedPassword, setStoredPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recipients, setRecipients] = useState<RecipientSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSignal, setFilterSignal] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;

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
      // Load stats
      const statsResponse = await fetch('/api/admin/stats', {
        headers: { Authorization: authHeader },
      });

      if (!statsResponse.ok) {
        throw new Error('Failed to load stats — check your password');
      }

      const statsData = await statsResponse.json();
      setStats(statsData);

      // Load recipients
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      if (filterStatus) params.append('status', filterStatus);
      if (filterSignal) params.append('signal', filterSignal);

      const recipientsResponse = await fetch(`/api/admin/recipients?${params}`, {
        headers: { Authorization: authHeader },
      });

      if (!recipientsResponse.ok) {
        throw new Error('Failed to load recipients');
      }

      const recipientsData: RecipientsResponse = await recipientsResponse.json();
      setRecipients(recipientsData.data);
      setTotal(recipientsData.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = () => loadDashboardWithPassword();

  const handleSync = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { Authorization: getAuthHeader() },
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const data = await response.json();
      alert(`Sync successful: ${data.message}`);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/push', {
        method: 'POST',
        headers: { Authorization: getAuthHeader() },
      });

      if (!response.ok) {
        throw new Error('Push failed');
      }

      const data = await response.json();
      alert(`Push successful: ${data.message}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLetter = async (recipientId: number, personalize: boolean = true) => {
    try {
      const method = personalize ? 'POST' : 'GET';
      const response = await fetch(`/api/letter/${recipientId}`, {
        method,
        headers: { Authorization: getAuthHeader() },
      });

      if (!response.ok) {
        throw new Error('Failed to generate letter');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `letter_${recipientId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleBatchDownload = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/batch-letters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify({
          status: filterStatus || undefined,
          signal_category: filterSignal || undefined,
          personalize: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate batch letters');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `asksopia-letters-${timestamp}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download batch');
    } finally {
      setLoading(false);
    }
  };

  const openLandingPage = (token: string) => {
    window.open(`/r/${token}`, '_blank');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setPassword('');
    setStats(null);
    setRecipients([]);
  };

  const handleFilterChange = () => {
    setOffset(0);
    loadDashboard();
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-2xl p-8">
            <h1 className="text-3xl font-bold text-center mb-2" style={{ color: '#1a1a2e' }}>
              askSOPia
            </h1>
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

              <button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold" style={{ color: '#1a1a2e' }}>
            Dashboard
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderColor: '#3b82f6' }}>
              <p className="text-gray-600 text-sm font-medium">Total Recipients</p>
              <p className="text-4xl font-bold mt-2" style={{ color: '#3b82f6' }}>
                {stats.totalRecipients}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderColor: '#3b82f6' }}>
              <p className="text-gray-600 text-sm font-medium">Page Visits</p>
              <p className="text-4xl font-bold mt-2" style={{ color: '#3b82f6' }}>
                {stats.pageVisits}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderColor: '#10b981' }}>
              <p className="text-gray-600 text-sm font-medium">Video 50%+</p>
              <p className="text-4xl font-bold mt-2" style={{ color: '#10b981' }}>
                {stats.video50Plus}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderColor: '#8b5cf6' }}>
              <p className="text-gray-600 text-sm font-medium">CTA Clicks</p>
              <p className="text-4xl font-bold mt-2" style={{ color: '#8b5cf6' }}>
                {stats.ctaClicks}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={async () => {
              setLoading(true);
              await loadDashboard();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw size={20} />
            Refresh
          </button>

          <button
            onClick={handleSync}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition disabled:opacity-50"
          >
            <CheckCircle size={20} />
            Sync from ClickUp
          </button>

          <button
            onClick={handlePush}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition disabled:opacity-50"
          >
            <CheckCircle size={20} />
            Push to ClickUp
          </button>

          <button
            onClick={handleBatchDownload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition disabled:opacity-50"
          >
            <Download size={20} />
            Download Letters (ZIP)
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#1a1a2e' }}>
            Filters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setTimeout(handleFilterChange, 0);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
                <option value="no_interest">No Interest</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Signal Category</label>
              <input
                type="text"
                value={filterSignal}
                onChange={(e) => {
                  setFilterSignal(e.target.value);
                  setTimeout(handleFilterChange, 0);
                }}
                placeholder="Filter by signal..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Recipients Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: '#1a1a2e' }}>
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Company</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Signal</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Video %</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Visits</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Last Activity</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((recipient) => (
                  <tr key={recipient.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">
                      {recipient.first_name} {recipient.last_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{recipient.company || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{recipient.signal_category || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          recipient.status === 'hot'
                            ? 'bg-red-100 text-red-800'
                            : recipient.status === 'warm'
                              ? 'bg-yellow-100 text-yellow-800'
                              : recipient.status === 'no_interest'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {recipient.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{Math.round(recipient.max_video_percent * 100)}%</td>
                    <td className="px-6 py-4 text-sm">{recipient.page_visits}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {recipient.last_activity
                        ? new Date(recipient.last_activity).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      <button
                        onClick={() => handleGenerateLetter(recipient.id)}
                        title="Generate PDF letter"
                        className="p-1 hover:bg-gray-200 rounded transition"
                      >
                        <FileText size={18} className="text-blue-500" />
                      </button>
                      <button
                        onClick={() => openLandingPage(recipient.token)}
                        title="View landing page"
                        className="p-1 hover:bg-gray-200 rounded transition"
                      >
                        <Eye size={18} className="text-green-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} recipients
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setOffset(Math.max(0, offset - limit));
                  loadDashboard();
                }}
                disabled={offset === 0}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Previous
              </button>
              <button
                onClick={() => {
                  setOffset(offset + limit);
                  loadDashboard();
                }}
                disabled={offset + limit >= total}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
