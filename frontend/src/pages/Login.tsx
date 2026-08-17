import React from 'react';
import { LogIn, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Login: React.FC = () => {
  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-8 shadow-xl">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 mx-auto mb-4 border border-blue-500/30">
          <LogIn className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-center text-white mb-2">Login</h2>
        <p className="text-sm text-slate-400 text-center mb-6">
          Access your collaborative proctored coding sessions.
        </p>

        <div className="bg-amber-950/40 border border-amber-700/50 rounded-lg p-4 mb-6 flex items-start gap-3 text-amber-200 text-xs">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-300">Placeholder Page (Week 1)</p>
            <p className="text-amber-400/90 mt-0.5">
              Authentication, JWT handling, and user login logic will be implemented in Week 2.
            </p>
          </div>
        </div>

        <div className="space-y-4 opacity-50 pointer-events-none">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              disabled
              placeholder="user@example.com"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              disabled
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-400"
            />
          </div>
          <button
            disabled
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold cursor-not-allowed"
          >
            Sign In (Disabled in Week 1)
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
};
