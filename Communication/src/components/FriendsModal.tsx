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
      // Filter out users already in friends list
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Creative Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                Study Buddies & Collaborators
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
                  {friends.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Connect with peers, invite to active rooms, or launch instant pair sessions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message Notification */}
        {message && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl flex items-center gap-2.5 text-xs font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 pt-3 gap-6 bg-slate-50/50">
          <button
            onClick={() => {
              setActiveTab('list');
              setMessage(null);
            }}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'list'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            My Friends ({friends.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('add');
              setMessage(null);
            }}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'add'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Add New Friend
          </button>
        </div>

        {/* Tab 1: Friends List */}
        {activeTab === 'list' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-2" />
                <p className="text-xs">Loading study buddies...</p>
              </div>
            ) : friends.length === 0 ? (
              <div className="py-12 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 p-6">
                <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 mb-1">No friends added yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                  Add classmates, peers, or interview partners to collaborate in real-time code rooms with zero setup!
                </p>
                <button
                  onClick={() => setActiveTab('add')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  Find & Add Friends
                </button>
              </div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-indigo-300 hover:shadow-sm transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 border border-indigo-200 text-indigo-700 font-bold flex items-center justify-center text-sm shadow-inner flex-shrink-0">
                      {friend.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800 truncate">{friend.name}</p>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            friend.role === 'INTERVIEWER'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {friend.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{friend.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* If inside active session, show 1-click Invite to Active */}
                    {currentSessionId && (
                      <button
                        onClick={() => handleInviteToCurrent(friend)}
                        disabled={actionLoading === `invite-${friend.id}`}
                        className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
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
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-50"
                      title="Launch a new collaborative session with this buddy"
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
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Add Friend Directly by Email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="peer@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                  className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 placeholder-slate-400"
                />
                <button
                  onClick={() => handleAddFriend()}
                  disabled={!emailInput.trim() || !!actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
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
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Search Registered Classmates & Peers
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search by student name or email..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 placeholder-slate-400"
                />
                {searching && (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600 absolute right-3.5 top-3" />
                )}
              </div>

              {/* Search Results list */}
              <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between hover:border-indigo-200 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{user.name}</p>
                          <p className="text-[11px] text-slate-400">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddFriend(undefined, user.id)}
                        disabled={actionLoading === user.id}
                        className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === user.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        <span>Add</span>
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
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Friends can join code rooms instantly with 1-click
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
