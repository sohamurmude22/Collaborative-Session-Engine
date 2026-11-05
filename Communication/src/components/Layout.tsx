import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar.js';
import { useTheme } from '../context/ThemeContext.js';
import { CSELogo } from './CSELogo.js';

export const Layout: React.FC = () => {
  const { themeConfig } = useTheme();
  const location = useLocation();
  const isSessionRoute = location.pathname.startsWith('/sessions/');

  return (
    <div
      className={`${
        isSessionRoute ? 'h-screen overflow-hidden' : 'min-h-screen'
      } ${themeConfig.bgPage} text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 selection:bg-indigo-500 selection:text-white relative`}
    >
      <Navbar />

      <main className="flex-1 w-full relative z-10 flex flex-col overflow-hidden min-h-0">
        <Outlet />
      </main>

      {!isSessionRoute && (
        <footer className="border-t border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#090d16]/80 backdrop-blur-md py-4 text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CSELogo size="xs" withText={false} animated={false} />
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
      )}
    </div>
  );
};
