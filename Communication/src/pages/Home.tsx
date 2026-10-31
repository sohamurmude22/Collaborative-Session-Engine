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
  Code2,
  Users,
  Video,
  CheckCircle2,
  Cpu,
  Layers,
  Flame,
  Key
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/index.js';

export const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="space-y-24 max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-200">
      {/* Hero Section */}
      <div className="relative pt-8 pb-12 text-center space-y-8">
        {/* Ambient Glow Orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-500/20 via-violet-500/15 to-cyan-500/15 blur-3xl rounded-full pointer-events-none -z-10" />

        {/* Shimmer Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 dark:bg-white/5 border border-indigo-500/30 dark:border-white/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold shadow-xs backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
          <span>Real-Time Collaborative Coding with Dynamic Access Matrix</span>
        </div>

        {/* Main Headline */}
        <div className="space-y-4 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1] font-heading">
            Collaborate in Real Time. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400">
              Control & Audit Seamlessly.
            </span>
          </h1>

          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed">
            The high-performance session platform built for technical interviews, pair programming, and granular code proctoring.
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 hover:-translate-y-0.5"
            >
              <Terminal className="w-4 h-4" />
              <span>Launch Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 hover:-translate-y-0.5"
              >
                <span>Start Free Session</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 rounded-xl text-sm font-semibold border border-slate-200 dark:border-white/10 shadow-xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <span>Sign In</span>
              </Link>
            </>
          )}
        </div>

        {/* Live IDE Mockup Showcase */}
        <div className="pt-8 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-[#0b101b]/80 backdrop-blur-xl shadow-2xl overflow-hidden linear-highlight">
            {/* Window Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/60 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-2" />
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">session-engine // technical-interview-049</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  LIVE SYNC (YJS)
                </span>
              </div>
            </div>

            {/* Split Screen Mockup */}
            <div className="grid grid-cols-1 md:grid-cols-12 text-left font-mono text-xs">
              {/* Left Explorer & Status */}
              <div className="md:col-span-3 p-3.5 border-r border-slate-200 dark:border-white/10 bg-slate-50/30 dark:bg-black/20 space-y-3 hidden md:block">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Session Files</div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5" /> solution.cpp
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-500 font-sans">EDIT</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-rose-500" /> test_cases.h
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-sans">LOCKED</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-amber-500" /> hint_2.md
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-sans">HIDDEN</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-white/10">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Collaborators</div>
                  <div className="space-y-1.5 text-[11px] font-sans">
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Sarah Chen</span>
                      <span className="text-[9px] font-mono px-1 rounded bg-indigo-500/15 text-indigo-500">INTERVIEWER</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span>Alex Rivera</span>
                      <span className="text-[9px] font-mono px-1 rounded bg-cyan-500/15 text-cyan-500">CANDIDATE</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Code Content Editor Area */}
              <div className="md:col-span-9 p-4 bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white space-y-2 overflow-x-auto">
                <div className="text-slate-500 font-sans text-[11px] pb-1 border-b border-slate-800 flex items-center justify-between">
                  <span>// Dynamic File Access Matrix & Real-Time CRDT Yjs Synchronization</span>
                  <span className="text-indigo-400">Lines: 14 &middot; UTF-8</span>
                </div>
                <pre className="text-slate-300 leading-relaxed">
                  <code>
{`1  #include <iostream>
2  #include <vector>
3  
4  // Target: Find two integers whose sum equals target in O(N)
5  std::vector<int> twoSum(const std::vector<int>& nums, int target) {
6      std::unordered_map<int, int> lookup;
7      for (int i = 0; i < nums.size(); ++i) {
8          int complement = target - nums[i];
9          if (lookup.count(complement)) {
10             return {lookup[complement], i};`} <span className="bg-indigo-600/40 text-cyan-300 px-1 rounded inline-block animate-pulse">| Cursor: Alex Rivera</span>
{`11         }
12         lookup[nums[i]] = i;
13     }
14     return {};
15 }`}
                  </code>
                </pre>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 flex items-center gap-2 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Execution Output: [0, 1] &middot; Process returned 0 (in 12ms)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Pillar Grid */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
            Core Architecture
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
            Engineered for Precision & Trust
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shadow-xs">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white font-heading">
                Dynamic File Matrix
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Instantly lock, unlock, hide, and reveal files in real-time. Backed by strict server-side authorization so restricted files never leak.
              </p>
            </div>
          </div>

          <div className="glass-card p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center shadow-xs">
              <Eye className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white font-heading">
                Progressive Reveal
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Staged interview problems, hints, and test cases revealed step-by-step. Hidden content is completely scrubbed from participant API responses.
              </p>
            </div>
          </div>

          <div className="glass-card p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 flex items-center justify-center shadow-xs">
              <History className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white font-heading">
                Granular Audit Replay
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Every keystroke, permission change, and file reveal is logged to an immutable audit timeline, replayable at any speed with video synchronization.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Developer Spec Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100/60 dark:bg-white/[0.02] p-8 sm:p-10 backdrop-blur-md">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
              &lt; 50ms
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">CRDT Sync Latency</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-heading tracking-tight">
              100%
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Server-Side Enforced</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-extrabold text-cyan-600 dark:text-cyan-400 font-heading tracking-tight">
              WebRTC
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Audio, Video & Screenshare</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-extrabold text-violet-600 dark:text-violet-400 font-heading tracking-tight">
              Monaco
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">VS Code Native Editor</div>
          </div>
        </div>
      </div>
    </div>
  );
};
