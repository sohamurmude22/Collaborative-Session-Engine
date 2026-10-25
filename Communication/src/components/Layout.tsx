import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar.js';
import { Terminal } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';

export const Layout: React.FC = () => {
  const { themeConfig } = useTheme();

  return (
    <div className={`min-h-screen ${themeConfig.bgPage} text-slate-900 flex flex-col font-sans transition-colors duration-200 selection:bg-indigo-600 selection:text-white`}>
      <Navbar />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <footer className={`border-t ${themeConfig.border} ${themeConfig.bgCard} py-4 text-center text-xs text-slate-500 transition-colors duration-200`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-semibold text-slate-800">CSE</span>
            <span className="text-slate-400">&middot; Collaborative Session Engine</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            Dynamic Session-Based Access Control & Real-Time Collaboration &middot; {themeConfig.name}
          </p>
        </div>
      </footer>
    </div>
  );
};
