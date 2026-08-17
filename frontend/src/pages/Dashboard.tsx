import React from 'react';
import { Info, PlusCircle, Users, ShieldAlert, History } from 'lucide-react';

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Session Dashboard</h1>
          <p className="text-sm text-slate-400">Manage collaborative coding rooms, access controls, and proctored exams.</p>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/50 text-blue-200 rounded-lg text-sm font-semibold cursor-not-allowed border border-blue-500/30"
        >
          <PlusCircle className="w-4 h-4" />
          Create Session (Week 2)
        </button>
      </div>

      <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-5 flex items-start gap-3 text-amber-200 text-sm">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-300">Placeholder Dashboard (Week 1)</p>
          <p className="text-amber-400/90 mt-1">
            Session models, role permissions, and active session management will be built in Week 2. Real-time editing with Yjs & Monaco will be integrated in subsequent weeks.
          </p>
        </div>
      </div>

      {/* Feature Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-3 opacity-60">
          <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-white text-sm">Collaborative Rooms</h3>
          <p className="text-xs text-slate-400">
            Real-time multi-user synchronization with conflict-free replication (Yjs) and granular file locks.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-3 opacity-60">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-white text-sm">Exam & Interview Proctoring</h3>
          <p className="text-xs text-slate-400">
            Tab switch detection, clipboard monitoring, read-only observer modes, and strict proctor rules.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-3 opacity-60">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-white text-sm">Session Replay</h3>
          <p className="text-xs text-slate-400">
            Time-travel debugging and keyframe-based code playback for candidate evaluation.
          </p>
        </div>
      </div>
    </div>
  );
};
