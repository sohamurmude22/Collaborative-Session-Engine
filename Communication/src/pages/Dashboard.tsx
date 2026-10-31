import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/index.js';
import { sessionService } from '../services/api.js';
import { ISession } from '../types/cse.js';
import {
  Terminal,
  PlusCircle,
  KeyRound,
  ArrowRight,
  Clock,
  CheckCircle2,
  Users,
  Shield,
  Code2,
  Copy,
  Check,
  UserPlus,
  Sparkles,
  History,
  Archive,
  Calendar,
  Layers,
  Activity,
  Video,
  Trash2,
  AlertTriangle,
  Play,
  Search
} from 'lucide-react';
import { FriendsModal } from '../components/FriendsModal.js';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [selectedTab, setSelectedTab] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [joinError, setJoinError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCandidateEmail, setNewCandidateEmail] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Delete session modal state
  const [sessionToDelete, setSessionToDelete] = useState<ISession | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSessionId, setInviteSessionId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('CANDIDATE');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Questions configuration for Interviewer
  interface QuestionPresetItem {
    title: string;
    description: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    status: 'REVEALED' | 'HIDDEN';
    selected: boolean;
  }

  const defaultQuestionsPreset: QuestionPresetItem[] = [
    {
      title: 'Two Sum',
      description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. Each input has exactly one solution.',
      difficulty: 'EASY',
      status: 'REVEALED',
      selected: true
    },
    {
      title: 'Reverse Linked List',
      description: 'Given the head of a singly linked list, reverse the list, and return the reversed list. Implement both iterative and recursive approaches.',
      difficulty: 'MEDIUM',
      status: 'HIDDEN',
      selected: true
    },
    {
      title: 'Longest Substring Without Repeating Characters',
      description: 'Given a string s, find the length of the longest substring without duplicate characters.',
      difficulty: 'MEDIUM',
      status: 'HIDDEN',
      selected: false
    }
  ];

  const [questionsList, setQuestionsList] = useState<QuestionPresetItem[]>(defaultQuestionsPreset);
  const [showAddCustomQuestion, setShowAddCustomQuestion] = useState(false);
  const [customQTitle, setCustomQTitle] = useState('');
  const [customQDesc, setCustomQDesc] = useState('');
  const [customQDiff, setCustomQDiff] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [customQStatus, setCustomQStatus] = useState<'REVEALED' | 'HIDDEN'>('HIDDEN');
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await sessionService.getAll();
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await sessionService.getUsersList();
      setAvailableUsers(data.filter((u) => u.id !== user?.id));
    } catch (err) {
      console.warn('Could not fetch user list:', err);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchUsers();
  }, []);

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      setIsDeleting(true);
      await sessionService.delete(sessionToDelete.id);
      setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
      setDeleteFeedback(`Session "${sessionToDelete.title}" and its history records were permanently deleted.`);
      setSessionToDelete(null);
      setTimeout(() => setDeleteFeedback(null), 5000);
    } catch (err: any) {
      console.error('Failed to delete session:', err);
      alert(err.response?.data?.error?.message || 'Failed to delete session history.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    if (!joinCode.trim()) return;

    try {
      const session = await sessionService.getByCode(joinCode.trim());
      const isHost =
        (session.interviewerId as any)?._id === user?.id ||
        (session.interviewerId as any) === user?.id ||
        user?.role === 'ADMIN';

      if (isHost) {
        navigate(`/sessions/${session.id}/interviewer`);
      } else {
        navigate(`/sessions/${session.id}/candidate`);
      }
    } catch (err: any) {
      setJoinError(err.response?.data?.error?.message || 'Could not find session with this code.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const selectedQuestions = questionsList
        .filter((q) => q.selected && q.title.trim())
        .map((q) => ({
          title: q.title.trim(),
          description: q.description.trim(),
          difficulty: q.difficulty,
          status: q.status
        }));

      const created = await sessionService.create({
        title: newTitle.trim(),
        description: newDesc.trim(),
        candidateEmail: newCandidateEmail.trim() || undefined,
        questions: selectedQuestions.length > 0 ? selectedQuestions : undefined
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewCandidateEmail('');
      navigate(`/sessions/${created.id}/interviewer`);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to create session');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const openInviteModal = (sessionId: string) => {
    setInviteSessionId(sessionId);
    setInviteEmail('');
    setInviteSuccess(null);
    setShowInviteModal(true);
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteSessionId || !inviteEmail.trim()) return;

    try {
      setInviteLoading(true);
      await sessionService.addParticipant(inviteSessionId, {
        email: inviteEmail.trim(),
        role: inviteRole
      });
      setInviteSuccess(`User successfully added to session!`);
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess(null);
        fetchSessions();
      }, 1500);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to add user to session.');
    } finally {
      setInviteLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            ACTIVE
          </span>
        );
      case 'PAUSED':
        return (
          <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
            PAUSED
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10">
            <Archive className="w-3 h-3 text-slate-400" />
            ARCHIVED
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
            {status}
          </span>
        );
    }
  };

  const activeSessions = sessions.filter((s) => s.status !== 'COMPLETED');
  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED');
  const baseSessions =
    selectedTab === 'active'
      ? activeSessions
      : selectedTab === 'completed'
      ? completedSessions
      : sessions;

  const displayedSessions = baseSessions.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sessionCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-slate-800 dark:text-slate-200 font-sans space-y-8">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
              Developer Workspaces
            </h1>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              {sessions.length} Rooms
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Welcome back, <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.name}</span>. Real-time coding, dynamic access control, and proctoring telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowFriendsModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition border border-slate-200 dark:border-white/10 cursor-pointer shadow-xs"
          >
            <Users className="w-4 h-4 text-indigo-500" />
            <span>Network</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs sm:text-sm font-semibold transition shadow-md shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Total Workspaces</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white font-heading">{sessions.length}</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Active Rooms</p>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-heading">{activeSessions.length}</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
            <History className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Archived Replays</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white font-heading">{completedSessions.length}</p>
          </div>
        </div>

        <div
          onClick={() => setShowFriendsModal(true)}
          className="glass-card p-4 flex items-center gap-3.5 cursor-pointer hover:border-indigo-500/40 transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-bold group-hover:scale-105 transition">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Collaborators</p>
            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:underline">
              Manage Friends &rarr;
            </p>
          </div>
        </div>
      </div>

      {/* Quick Join Bar & Search */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Join Live Room</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Enter a 6-digit access code (e.g. CSE-DEMO26)</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
          <form onSubmit={handleJoin} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="CODE (e.g. CSE-DEMO)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="w-full sm:w-48 px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 uppercase font-mono tracking-wider transition"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs whitespace-nowrap"
            >
              Enter Room
            </button>
          </form>

          {/* Quick Search */}
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
            />
          </div>
        </div>
      </div>

      {joinError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{joinError}</span>
        </div>
      )}

      {deleteFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{deleteFeedback}</span>
          </div>
          <button
            onClick={() => setDeleteFeedback(null)}
            className="text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs for Active vs History Records */}
      <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-white/10 pb-1">
        <button
          onClick={() => setSelectedTab('all')}
          className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            selectedTab === 'all'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>All Sessions ({sessions.length})</span>
        </button>

        <button
          onClick={() => setSelectedTab('active')}
          className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            selectedTab === 'active'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-500" />
          <span>Active Rooms ({activeSessions.length})</span>
        </button>

        <button
          onClick={() => setSelectedTab('completed')}
          className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            selectedTab === 'completed'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <History className="w-4 h-4 text-amber-500" />
          <span>Session Archives ({completedSessions.length})</span>
        </button>
      </div>

      {/* Sessions Grid */}
      <div>
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-mono">Synchronizing workspace states...</p>
          </div>
        ) : displayedSessions.length === 0 ? (
          <div className="py-16 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center glass-panel p-8">
            <Terminal className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              {searchQuery
                ? 'No matching workspaces found'
                : selectedTab === 'completed'
                ? 'No completed sessions in archives'
                : 'No collaborative workspaces yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {selectedTab === 'completed'
                ? 'When an interview session is concluded with End Session, it will be archived here with full replay records.'
                : 'Get started by creating a new collaborative workspace or join one using an access code.'}
            </p>
            {selectedTab !== 'completed' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition hover:-translate-y-0.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Workspace</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayedSessions.map((s) => {
              const isHost =
                (s.interviewerId as any)?._id === user?.id ||
                (s.interviewerId as any) === user?.id ||
                user?.role === 'ADMIN';

              const isCompleted = s.status === 'COMPLETED';

              const targetUrl = isHost
                ? `/sessions/${s.id}/interviewer`
                : `/sessions/${s.id}/candidate`;

              return (
                <div
                  key={s.id}
                  className="glass-card p-5 flex flex-col justify-between group hover:border-indigo-500/40 relative"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/20">
                          {s.sessionCode}
                        </span>
                        <button
                          onClick={() => handleCopyCode(s.sessionCode)}
                          title="Copy session code"
                          className="p-1 text-slate-400 hover:text-indigo-500 transition cursor-pointer"
                        >
                          {copiedCode === s.sessionCode ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(s.status)}
                        {isCompleted && (
                          <button
                            onClick={() => setSessionToDelete(s)}
                            title="Delete session history & record"
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 mb-1 font-heading group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      {s.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                      {s.description || 'Collaborative coding and interview session.'}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-white/10">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{s.candidateId ? 'Candidate Connected' : 'Waiting for Peer'}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-semibold uppercase">
                        {isHost ? 'Host' : 'Participant'}
                      </span>
                    </div>

                    {/* Action buttons based on completed or active */}
                    {isCompleted ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/sessions/${s.id}/replay`}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/20 transition cursor-pointer"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>10m Replay</span>
                          </Link>
                          <Link
                            to={targetUrl}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 transition cursor-pointer"
                          >
                            <span>Review Code</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => openInviteModal(s.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/10 transition cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                          <span>Invite</span>
                        </button>

                        <Link
                          to={targetUrl}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/35 transition cursor-pointer"
                        >
                          <span>{isHost ? 'Launch Studio' : 'Enter Workspace'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl my-8 relative linear-highlight animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 font-heading">
              Create Collaborative Workspace
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Spin up a live room for technical interviews or pair coding with real-time CRDT sync and default .cpp sandbox.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Workspace Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. C++ Algorithms Interview: Dynamic Programming"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief objectives or guidelines..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Candidate Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="candidate@domain.com"
                  value={newCandidateEmail}
                  onChange={(e) => setNewCandidateEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
                />
              </div>

              {/* Questions Section for Interviewer */}
              <div className="border border-slate-200 dark:border-white/10 rounded-xl p-3.5 bg-slate-50/50 dark:bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block font-heading">
                      Interview Questions & Progressive Reveal
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Hidden questions can be revealed dynamically during the session.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomQuestion(!showAddCustomQuestion)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {showAddCustomQuestion ? '− Close Custom' : '+ Add Custom'}
                  </button>
                </div>

                {/* Preset Questions List */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {questionsList.map((q, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border text-xs transition ${
                        q.selected
                          ? 'bg-white dark:bg-white/5 border-indigo-500/30 shadow-xs'
                          : 'bg-slate-100/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={q.selected}
                            onChange={(e) => {
                              const updated = [...questionsList];
                              updated[idx].selected = e.target.checked;
                              setQuestionsList(updated);
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="font-semibold text-slate-900 dark:text-white truncate">{q.title}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              q.difficulty === 'EASY'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {q.difficulty}
                          </span>
                        </label>

                        {q.selected && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-400">Initial:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...questionsList];
                                updated[idx].status = updated[idx].status === 'REVEALED' ? 'HIDDEN' : 'REVEALED';
                                setQuestionsList(updated);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                                q.status === 'REVEALED'
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : 'bg-amber-500 text-white shadow-xs'
                              }`}
                            >
                              {q.status === 'REVEALED' ? 'Revealed' : 'Hidden (Live)'}
                            </button>
                          </div>
                        )}
                      </div>
                      {q.selected && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 pl-6">
                          {q.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Custom Question Sub-form */}
                {showAddCustomQuestion && (
                  <div className="p-3 bg-white dark:bg-white/5 border border-indigo-500/30 rounded-xl space-y-2 mt-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Create Custom Problem</span>
                    <input
                      type="text"
                      placeholder="Title (e.g. Valid Anagram)"
                      value={customQTitle}
                      onChange={(e) => setCustomQTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                    <textarea
                      rows={2}
                      placeholder="Problem statement / instructions..."
                      value={customQDesc}
                      onChange={(e) => setCustomQDesc(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={customQDiff}
                          onChange={(e: any) => setCustomQDiff(e.target.value)}
                          className="px-2 py-1 bg-slate-50 dark:bg-[#090d16] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                        >
                          <option value="EASY">Easy</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HARD">Hard</option>
                        </select>
                        <select
                          value={customQStatus}
                          onChange={(e: any) => setCustomQStatus(e.target.value)}
                          className="px-2 py-1 bg-slate-50 dark:bg-[#090d16] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                        >
                          <option value="HIDDEN">Initially Hidden</option>
                          <option value="REVEALED">Initially Revealed</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!customQTitle.trim()) return;
                          setQuestionsList([
                            ...questionsList,
                            {
                              title: customQTitle.trim(),
                              description: customQDesc.trim(),
                              difficulty: customQDiff,
                              status: customQStatus,
                              selected: true
                            }
                          ]);
                          setCustomQTitle('');
                          setCustomQDesc('');
                          setShowAddCustomQuestion(false);
                        }}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow-xs"
                      >
                        Add Problem
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold rounded-xl transition shadow-md shadow-indigo-600/25 hover:shadow-indigo-600/40 cursor-pointer"
                >
                  Launch Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Collaborator Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative linear-highlight animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1 font-heading">
              Invite Peer to Workspace
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Grant real-time code editing and collaborative access to this session.
            </p>

            {inviteSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                {inviteSuccess}
              </div>
            )}

            <form onSubmit={handleAddParticipant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Registered User
                </label>
                <select
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
                >
                  <option value="">-- Choose from existing users --</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.name} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Or Direct Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="collaborator@domain.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Workspace Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
                >
                  <option value="CANDIDATE">Candidate / Peer Coder</option>
                  <option value="INTERVIEWER">Interviewer / Co-Host</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-indigo-600/25 disabled:opacity-50 cursor-pointer"
                >
                  {inviteLoading ? 'Sending...' : 'Add Collaborator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Finished Session Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="glass-panel rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                  Delete Workspace Record?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Permanently erase session timeline & recording</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3.5 mb-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Title:</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {sessionToDelete.title}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Code:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {sessionToDelete.sessionCode}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-600 dark:text-rose-400 mb-5 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                This will permanently delete this finished session from your history, including code files, screen recording, and audit telemetry. This cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteSession}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Friends & Study Buddies Modal */}
      <FriendsModal
        isOpen={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
      />
    </div>
  );
};
