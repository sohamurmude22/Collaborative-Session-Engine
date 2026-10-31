import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar.js';
import { Terminal, ShieldCheck, Cpu } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';

export const Layout: React.FC = () => {
  const { themeConfig, isDark } = useTheme();

  return (
    <div
      className={`min-h-screen ${themeConfig.bgPage} text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 selection:bg-indigo-500 selection:text-white relative`}
    >
      <Navbar />

      <main className="flex-1 w-full relative z-10 flex flex-col">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#090d16]/80 backdrop-blur-md py-4 text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-indigo-600/10 dark:bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Terminal className="w-3 h-3" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-200 tracking-tight">CSE Platform</span>
            <span className="text-slate-300 dark:text-slate-700">&middot;</span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Real-Time Collaborative Proctoring & Session Engine</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Operational</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">&middot;</span>
            <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">
              Theme: {themeConfig.name}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
