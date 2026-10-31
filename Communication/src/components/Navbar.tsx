import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Terminal,
  LayoutDashboard,
  LogIn,
  UserPlus,
  LogOut,
  Shield,
  Users,
  Code2,
  Menu,
  X,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/index.js';
import { FriendsModal } from './FriendsModal.js';
import { ThemeSelector } from './ThemeSelector.js';
import { UserAvatar } from './UserAvatar.js';
import { ProfileModal } from './ProfileModal.js';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [friendsModalOpen, setFriendsModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path
      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border-b-2 border-indigo-600 dark:border-indigo-400'
      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white';
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30';
      case 'INTERVIEWER':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30';
      default:
        return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30';
    }
  };

  return (
    <header className="border-b border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#090d16]/85 backdrop-blur-xl sticky top-0 z-50 transition-colors duration-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 group-hover:shadow-indigo-500/40 transition-all duration-300">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg font-heading tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                CSE
                <span className="text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
                  STUDIO
                </span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 tracking-wide font-sans hidden sm:block">
                Collaborative Session Engine
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2">
            {isAuthenticated && user ? (
              <>
                <Link
                  to="/dashboard"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${isActive(
                    '/dashboard'
                  )}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Sessions</span>
                </Link>

                <button
                  onClick={() => setFriendsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium cursor-pointer"
                  title="Friends & Collaborators"
                >
                  <Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span>Network</span>
                </button>

                {user.role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${isActive(
                      '/admin'
                    )}`}
                  >
                    <Shield className="w-4 h-4 text-purple-500" />
                    <span>Admin</span>
                  </Link>
                )}

                <div className="h-5 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                {/* Theme Selector with Dark/Light Toggle */}
                <ThemeSelector />

                <div className="h-5 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                {/* User Profile Pill */}
                <button
                  onClick={() => setProfileModalOpen(true)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-white/5 hover:bg-indigo-500/10 border border-slate-200 dark:border-white/10 hover:border-indigo-500/40 transition cursor-pointer group"
                  title="Account Settings & Profile"
                >
                  <UserAvatar
                    name={user.name}
                    avatarUrl={user.avatarUrl}
                    role={user.role}
                    size="sm"
                    showStatus={true}
                    isOnline={true}
                  />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight max-w-[120px] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      {user.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase font-medium inline-block w-fit ${getRoleBadgeStyle(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-transform group-hover:translate-y-0.5" />
                </button>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <ThemeSelector />

                <div className="h-5 w-px bg-slate-200 dark:bg-white/10 mx-2" />

                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 shadow-md shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Get Started</span>
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeSelector compact={true} />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#090d16] px-4 pt-3 pb-5 space-y-2">
          {isAuthenticated && user ? (
            <>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 mb-3">
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  role={user.role}
                  size="md"
                  showStatus={true}
                  isOnline={true}
                />
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{user.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                </div>
              </div>

              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 p-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Sessions</span>
              </Link>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setFriendsModalOpen(true);
                }}
                className="w-full flex items-center gap-2 p-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-left"
              >
                <Users className="w-4 h-4 text-indigo-500" />
                <span>Friends & Network</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setProfileModalOpen(true);
                }}
                className="w-full flex items-center gap-2 p-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-left"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Profile & Customization</span>
              </button>

              {user.role === 'ADMIN' && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-lg text-sm text-purple-600 dark:text-purple-400 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin Panel</span>
                </Link>
              )}

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-2 p-2.5 rounded-lg text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <div className="space-y-2 pt-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-md shadow-indigo-600/30"
              >
                Create Free Account
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Friends & Collaborators Modal */}
      <FriendsModal
        isOpen={friendsModalOpen}
        onClose={() => setFriendsModalOpen(false)}
      />

      {/* User Profile Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </header>
  );
};
