import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Code2, LayoutDashboard, LogIn, UserPlus } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path
      ? 'bg-slate-800 text-blue-400 font-semibold'
      : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100';
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">CollabSession</span>
              <span className="ml-2 text-xs font-mono px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
                Week 1
              </span>
            </div>
          </Link>

          <nav className="flex items-center space-x-2">
            <Link
              to="/dashboard"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors ${isActive('/dashboard')}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/login"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors ${isActive('/login')}`}
            >
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </Link>
            <Link
              to="/register"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors ${isActive('/register')}`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Register</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};
