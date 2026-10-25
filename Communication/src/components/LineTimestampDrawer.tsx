import React, { useState } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  Code
} from 'lucide-react';

export interface LineTimestampRecord {
  lineNumber: number;
  text: string;
  timestamp: number;
  timeFormatted: string;
  author: string;
  isSuspicious?: boolean;
  burstSpeedMs?: number;
}

interface LineTimestampDrawerProps {
  isOpen?: boolean;
  onClose: () => void;
  lines?: LineTimestampRecord[];
  records?: LineTimestampRecord[];
  onJumpToLine?: (lineNumber: number) => void;
}

export const LineTimestampDrawer: React.FC<LineTimestampDrawerProps> = ({
  isOpen = true,
  onClose,
  lines,
  records,
  onJumpToLine
}) => {
  const [filterSuspiciousOnly, setFilterSuspiciousOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const activeLines = lines || records || [];
  const suspiciousCount = activeLines.filter((l) => l.isSuspicious).length;

  const filteredLines = activeLines.filter((l) => {
    if (filterSuspiciousOnly && !l.isSuspicious) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        l.text.toLowerCase().includes(q) ||
        String(l.lineNumber).includes(q) ||
        l.timeFormatted.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 md:w-[480px] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Line Timestamp History
              {suspiciousCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> {suspiciousCount} Flagged
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400">
              Millisecond-precision keystroke & burst audit
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Overview Cards */}
      <div className="p-3 bg-slate-950/40 border-b border-slate-800 grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Lines Tracked
          </span>
          <span className="text-lg font-mono font-bold text-white mt-0.5 block">
            {activeLines.length}
          </span>
        </div>

        <div className={`p-2.5 rounded-xl border ${
          suspiciousCount > 0
            ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
            : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
        }`}>
          <span className="text-[10px] font-semibold uppercase tracking-wider block opacity-80">
            Sub-50ms Bursts / Pastes
          </span>
          <span className="text-lg font-mono font-bold mt-0.5 block">
            {suspiciousCount} {suspiciousCount > 0 ? '⚠️ ALERT' : '✓ Normal'}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 border-b border-slate-800 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search line text or time..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          onClick={() => setFilterSuspiciousOnly(!filterSuspiciousOnly)}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            filterSuspiciousOnly
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Filter className="w-3 h-3" />
          <span>Flagged Only</span>
        </button>
      </div>

      {/* Lines Table / List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {filteredLines.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p className="font-semibold">No lines match filter</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Start typing or editing code to generate timestamps.
            </p>
          </div>
        ) : (
          filteredLines.map((record) => {
            return (
              <div
                key={record.lineNumber}
                onClick={() => onJumpToLine?.(record.lineNumber)}
                className={`p-2.5 rounded-xl border transition cursor-pointer ${
                  record.isSuspicious
                    ? 'bg-rose-950/30 border-rose-500/40 hover:bg-rose-950/50'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      Line {record.lineNumber}
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-slate-400">
                      {record.timeFormatted}
                    </span>
                  </div>

                  {record.isSuspicious ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/30 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> Rapid Paste (&lt;50ms)
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Normal Keystroke
                    </span>
                  )}
                </div>

                <div className="bg-slate-900/90 rounded-lg p-2 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre border border-slate-800/60">
                  {record.text || <span className="text-slate-600 italic">(empty line)</span>}
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Author: {record.author || 'User'}</span>
                  {record.burstSpeedMs !== undefined && (
                    <span className="font-mono text-amber-400">
                      Latency delta: {record.burstSpeedMs}ms
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Click any line to jump to editor</span>
        <button
          onClick={onClose}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
        >
          Close Drawer
        </button>
      </div>
    </div>
  );
};
