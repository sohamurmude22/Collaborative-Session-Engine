import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  UserCheck,
  Search,
  Trash2,
  Play,
  Share2,
  X,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { friendService, sessionService } from '../services/api';
import { IUser } from '../types/cse';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId?: string;
  currentSessionCode?: string;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  onClose,
  currentSessionId,
  currentSessionCode
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [friends, setFriends] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
  }, [isOpen]);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const data = await friendService.getFriends();
      setFriends(data);
    } catch (err: any) {
      console.error('Failed to load friends:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      const res = await friendService.searchUsers(query);
      const friendIds = new Set(friends.map((f) => f.id));
      setSearchResults(res.filter((u) => !friendIds.has(u.id)));
    } catch (err: any) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async (email?: string, userId?: string) => {
    const target = email || emailInput.trim();
    if (!target && !userId) return;

    try {
      setActionLoading(userId || target);
      setMessage(null);
      const res = await friendService.addFriend({
        email: email || (target ? target : undefined),
        userId
      });
      setFriends(res.friends);
      setMessage({ type: 'success', text: res.message });
      setEmailInput('');
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to add friend';
      setMessage({ type: 'error', text: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveFriend = async (friendId: string, friendName: string) => {
    if (!confirm(`Are you sure you want to remove ${friendName} from your friends?`)) return;

    try {
      setActionLoading(friendId);
      const res = await friendService.removeFriend(friendId);
      setFriends(res.friends);
      setMessage({ type: 'success', text: `${friendName} removed from friends.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to remove friend.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartSession = async (friend: IUser) => {
    try {
      setActionLoading(`session-${friend.id}`);
      setMessage(null);
      const res = await friendService.startSessionWithFriend({
        friendId: friend.id,
        title: `Pair Session with ${friend.name}`
      });
      setMessage({ type: 'success', text: 'Session created! Navigating...' });
      setTimeout(() => {
        onClose();
        navigate(`/session/${res.session.id}`);
      }, 600);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error?.message || 'Could not start session'
      });
      setActionLoading(null);
    }
  };

  const handleInviteToCurrent = async (friend: IUser) => {
    if (!currentSessionId) return;

    try {
      setActionLoading(`invite-${friend.id}`);
      setMessage(null);
      await sessionService.addParticipant(currentSessionId, {
        userId: friend.id,
        role: 'CANDIDATE'
      });
      setMessage({
        type: 'success',
        text: `${friend.name} has been invited to the active session!`
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error?.message || 'Failed to invite to session'
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl glass-panel rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] linear-highlight">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 font-heading">
                Peer Network & Friends
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  {friends.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect with collaborators and launch instant pair rooms
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message Notification */}
        {message && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl flex items-center gap-2.5 text-xs font-medium ${
              message.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200/80 dark:border-white/10 px-6 pt-3 gap-6 bg-slate-50/30 dark:bg-black/20">
          <button
            onClick={() => {
              setActiveTab('list');
              setMessage(null);
            }}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Friends List ({friends.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('add');
              setMessage(null);
            }}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'add'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Add Collaborator
          </button>
        </div>

        {/* Tab 1: Friends List */}
        {activeTab === 'list' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-2" />
                <p className="text-xs">Loading collaborator network...</p>
              </div>
            ) : friends.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-6 bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="w-12 h-12 mx-auto rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">No friends added yet</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                  Add classmates, peers, or interview partners to collaborate in real-time rooms with 1-click.
                </p>
                <button
                  onClick={() => setActiveTab('add')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Find & Add Collaborator
                </button>
              </div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] hover:border-indigo-500/40 hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-inner shrink-0">
                      {friend.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{friend.name}</p>
                        <span
                          className={`text-[9px] font-mono font-semibold px-2 py-0.2 rounded-full ${
                            friend.role === 'INTERVIEWER'
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/25'
                              : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/25'
                          }`}
                        >
                          {friend.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{friend.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* If inside active session, show 1-click Invite */}
                    {currentSessionId && (
                      <button
                        onClick={() => handleInviteToCurrent(friend)}
                        disabled={actionLoading === `invite-${friend.id}`}
                        className="px-2.5 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                        title="Invite to this active room"
                      >
                        {actionLoading === `invite-${friend.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5" />
                        )}
                        <span>Invite to Room</span>
                      </button>
                    )}

                    {/* 1-Click Launch Pair Session */}
                    <button
                      onClick={() => handleStartSession(friend)}
                      disabled={actionLoading === `session-${friend.id}`}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
                      title="Launch collaborative session"
                    >
                      {actionLoading === `session-${friend.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>Pair Up</span>
                    </button>

                    {/* Remove Friend */}
                    <button
                      onClick={() => handleRemoveFriend(friend.id, friend.name)}
                      disabled={actionLoading === friend.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                      title="Remove friend"
                    >
                      {actionLoading === friend.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Add New Friend */}
        {activeTab === 'add' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Quick Add by Email */}
            <div className="bg-slate-50 dark:bg-white/[0.02] p-4 rounded-xl border border-slate-200/80 dark:border-white/10">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-heading">
                Add Directly by Email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="collaborator@domain.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                  className="flex-1 px-3.5 py-2 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                />
                <button
                  onClick={() => handleAddFriend()}
                  disabled={!emailInput.trim() || !!actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {actionLoading === emailInput.trim() ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Add Friend
                </button>
              </div>
            </div>

            {/* Live Search Users */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-heading">
                Search Registered Users
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                />
                {searching && (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500 absolute right-3.5 top-3" />
                )}
              </div>

              {/* Search Results list */}
              <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((u) => (
                    <div
                      key={u.id}
                      className="p-3 bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 rounded-xl flex items-center justify-between hover:border-indigo-500/30 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{u.name}</p>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddFriend(undefined, u.id)}
                        disabled={actionLoading === u.id}
                        className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                      >
                        {actionLoading === u.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        <span>Connect</span>
                      </button>
                    </div>
                  ))
                ) : searchQuery.trim().length > 1 && !searching ? (
                  <p className="text-xs text-slate-400 text-center py-4">No matching users found.</p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            1-click launch or room invite
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
