import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/api.js';
import { Shield, Users, Activity, Terminal, Search, Clock, Key, CheckCircle2, Lock } from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar.js';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<{ totalUsers: number; totalSessions: number; totalLogs: number } | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUser, setSearchUser] = useState('');

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
        setUsers(usersRes.data.data || []);
        setLogs(logsRes.data.data || []);
      } catch (err) {
        console.error('Failed to load admin data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchUser.toLowerCase())
  );

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-mono">Loading System Administration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-slate-800 dark:text-slate-200 font-sans space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-500">
              <Shield className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
              System Administration
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Global telemetry, user directory, and security audit event logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            CLUSTER HEALTHY
          </span>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Users
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
            {stats?.totalUsers || 0}
          </p>
          <p className="text-[11px] text-slate-400">Registered across all roles</p>
        </div>

        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Sessions
            </span>
            <Terminal className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-heading">
            {stats?.totalSessions || 0}
          </p>
          <p className="text-[11px] text-slate-400">Workspaces created to date</p>
        </div>

        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Audit Events
            </span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-heading">
            {stats?.totalLogs || 0}
          </p>
          <p className="text-[11px] text-slate-400">Granular security events logged</p>
        </div>
      </div>

      {/* Users & Recent Global Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Table */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 font-heading">
              <Users className="w-4 h-4 text-indigo-500" />
              Registered Accounts ({users.length})
            </h2>

            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search user..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3 text-xs hover:border-indigo-500/40 transition"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar name={u.name} avatarUrl={u.avatarUrl} size="sm" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block leading-tight">{u.name}</span>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">{u.email}</p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    u.role === 'ADMIN'
                      ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/25'
                      : u.role === 'INTERVIEWER'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/25'
                      : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/25'
                  }`}
                >
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Global Audit Logs */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 font-heading">
              <Activity className="w-4 h-4 text-emerald-500" />
              Global Telemetry Stream ({logs.length})
            </h2>
            <span className="text-[10px] font-mono text-slate-400">Real-Time Event Feed</span>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 text-[11px] hover:border-emerald-500/40 transition space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10">
                    {log.eventType}
                  </span>
                  <span className="font-mono text-slate-400 text-[10px] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-sans">
                  <span className="font-semibold text-slate-900 dark:text-white">{log.actorName || log.actorRole}</span>
                  {' '}performed action on {log.resourceType}
                  {log.metadata?.fileName && (
                    <span className="font-mono text-indigo-500 dark:text-indigo-400"> ({log.metadata.fileName})</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
