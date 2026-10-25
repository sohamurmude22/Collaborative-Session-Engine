import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/api.js';
import { Shield, Users, Activity, Terminal } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<{ totalUsers: number; totalSessions: number; totalLogs: number } | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);
        const [statsRes, usersRes, logsRes] = await Promise.all([
          apiClient.get('/admin/stats'),
          apiClient.get('/admin/users'),
          apiClient.get('/admin/audit-logs')
        ]);
        setStats(statsRes.data.data);
        setUsers(usersRes.data.data);
        setLogs(logsRes.data.data);
      } catch (err) {
        console.error('Failed to load admin data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-slate-400 text-sm">Loading System Administration...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-slate-800 font-sans">
      <div className="pb-6 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-600" />
          <span>CSE System Administration</span>
        </h1>
        <p className="text-xs text-slate-500">
          Organization metrics, user management, and global audit security events.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Users</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats?.totalUsers || 0}</p>
        </div>
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Sessions</span>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{stats?.totalSessions || 0}</p>
        </div>
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Logged Audit Events</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats?.totalLogs || 0}</p>
        </div>
      </div>

      {/* Users & Recent Global Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Table */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            Registered Accounts
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">{u.name}</span>
                  <p className="text-slate-500 text-[11px]">{u.email}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Global Audit Logs */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            Global Audit Logs
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px]"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-mono font-bold text-indigo-700">{log.eventType}</span>
                  <span className="font-mono text-slate-400 text-[9px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-800">{log.actorName || log.actorRole}</span> on {log.resourceType}
                  {log.metadata?.fileName ? ` (${log.metadata.fileName})` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
