import React, { useEffect, useState } from 'react';
import { checkHealth } from '../services/api.js';
import { HealthCheckResponse } from '../types/index.js';
import { CheckCircle2, XCircle, RefreshCw, Server, Database, ArrowRight, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Home: React.FC = () => {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await checkHealth();
      setHealth(data);
    } catch (err: unknown) {
      console.error('Health check failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unable to connect to backend server';
      setError(errorMessage);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="text-center space-y-4 pt-6 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Week 1 Milestone Complete
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Collaborative Session Engine
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Real-Time Collaborative Code Editor with Granular, Replayable Access Control for Interview and Exam Proctoring.
        </p>
      </div>

      {/* Backend & DB Health Check Card */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">System Connectivity & Health</h2>
              <p className="text-xs text-slate-400">Live API communication: Frontend &rarr; Express Backend &rarr; MongoDB</p>
            </div>
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-xs font-medium text-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
            Testing backend connection (/api/health)...
          </div>
        ) : error ? (
          <div className="bg-rose-950/40 border border-rose-800/50 rounded-lg p-4 flex items-start gap-3 text-rose-200 text-sm">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">Connection Failed</p>
              <p className="text-xs text-rose-400 mt-1">{error}</p>
              <p className="text-xs text-slate-400 mt-2">Ensure the backend server is running on port 5000 with MongoDB connected.</p>
            </div>
          </div>
        ) : health ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-xs text-slate-400">Backend API (/api/health)</div>
                  <div className="text-sm font-semibold text-emerald-300">{health.message}</div>
                </div>
              </div>
              <span className="px-2 py-1 text-xs font-mono rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                HTTP 200 OK
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-xs text-slate-400">MongoDB Database</div>
                  <div className="text-sm font-semibold text-emerald-300">
                    Status: {health.database || 'Connected'}
                  </div>
                </div>
              </div>
              <span className="px-2 py-1 text-xs font-mono rounded bg-emerald-950 text-emerald-400 border border-emerald-800 capitalize">
                {health.database || 'online'}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Week 1 Scope & Placeholder Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <Layers className="w-4 h-4" />
            <span>Week 1 Foundation</span>
          </div>
          <p className="text-xs text-slate-400">
            Cleanly established Express + TypeScript backend, MongoDB Mongoose driver, React + Vite frontend, and Axios API layer.
          </p>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
            <Layers className="w-4 h-4" />
            <span>Week 2 Upcoming</span>
          </div>
          <p className="text-xs text-slate-400">
            Authentication, JWT, bcrypt, User/Session Mongoose models, and protected session routes.
          </p>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 flex flex-col justify-between space-y-3">
          <div>
            <div className="text-slate-200 font-semibold text-sm">Explore Placeholders</div>
            <p className="text-xs text-slate-400 mt-1">
              Visit placeholder routes ready for Week 2 implementation.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              Dashboard <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
