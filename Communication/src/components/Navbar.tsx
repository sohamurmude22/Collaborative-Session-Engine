import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Terminal,
  LayoutDashboard,
  LogIn,
  UserPlus,
  LogOut,
  Shield,
  PlusCircle,
  History,
  Users
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
  const [friendsModalOpen, setFriendsModalOpen] = React.useState(false);
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);

  const isActive = (path: string) => {
    return location.pathname === path
      ? 'bg-indigo-50 text-indigo-700 font-semibold border-b-2 border-indigo-600'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
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
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'INTERVIEWER':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-sky-50 text-sky-700 border-sky-200';
    }
  };

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-50 text-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg font-heading text-slate-900 tracking-tight flex items-center gap-2">
                CSE
                <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-slate-100 text-indigo-700 border border-slate-200">
                  Session Engine
                </span>
              </span>
            </div>
          </Link>

          <nav className="flex items-center space-x-2 sm:space-x-3">
            {isAuthenticated && user ? (
              <>
                <Link
                  to="/dashboard"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive(
                    '/dashboard'
                  )}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Sessions</span>
                </Link>

                <button
                  onClick={() => setFriendsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-medium cursor-pointer"
                  title="Friends & Collaborators"
                >
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Friends</span>
                </button>

                <ThemeSelector />

                {user.role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive(
                      '/admin'
                    )}`}
                  >
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span>Admin Panel</span>
                  </Link>
                )}

                <div className="h-6 w-px bg-slate-200 mx-1" />

                {/* Interactive User Profile & Avatar Pill */}
                <button
                  onClick={() => setProfileModalOpen(true)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-300 transition cursor-pointer text-left group"
                  title="Click to change profile picture & account settings"
                >
                  <UserAvatar
                    name={user.name}
                    avatarUrl={user.avatarUrl}
                    role={user.role}
                    size="sm"
                    showStatus={true}
                    isOnline={true}
                  />
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-800 leading-tight max-w-[130px] truncate group-hover:text-indigo-600 transition">
                      {user.name}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full border inline-block w-fit ${getRoleBadgeStyle(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </div>
                </button>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline font-medium">Exit</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Get Started</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>

      <FriendsModal
        isOpen={friendsModalOpen}
        onClose={() => setFriendsModalOpen(false)}
      />

      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </header>
  );
};
