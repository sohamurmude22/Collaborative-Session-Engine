import React from 'react';
import {
  Terminal,
  Shield,
  Lock,
  Sparkles,
  ArrowRight,
  Eye,
  Activity,
  History,
  Code
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/index.js';

export const Home: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="space-y-16 max-w-6xl mx-auto py-12 px-4 text-slate-800">
      {/* Hero Section */}
      <div className="text-center space-y-6 pt-6 pb-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Real-Time Collaborative Coding with Dynamic Access Control</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight font-heading">
          Collaborate in Real Time, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600">
            Control & Audit Seamlessly.
          </span>
        </h1>

        <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          CSE enables real-time pair coding, technical interviews, and collaborative engineering.
          Every user can create sessions, invite collaborators, edit code smoothly, and inspect session activity.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all hover:-translate-y-0.5"
            >
              Open Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all hover:-translate-y-0.5"
              >
                Sign In to Demo <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold border border-slate-200 shadow-xs transition-all hover:-translate-y-0.5"
              >
                Create Account
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 3 Pillar Core Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900">Dynamic File Matrix</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Instant lock, unlock, hide, and show. Control file access in real-time, backed by
              strict server-side authorization.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900">Progressive Reveal</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Reveal problems, hints, and test cases step-by-step. Hidden content is scrubbed from participant API
              responses to guarantee zero leaks.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900">Real-Time Sync & Replay</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Zero-lag peer synchronization, smooth debounced code persistence, and millisecond-precision
              timeline logs with zero browser freeze.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
