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
  Code,
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
  AlertTriangle
} from 'lucide-react';
import { FriendsModal } from '../components/FriendsModal.js';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [selectedTab, setSelectedTab] = useState<'all' | 'active' | 'completed'>('all');
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
      // Gather selected questions
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
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ACTIVE
          </span>
        );
      case 'PAUSED':
        return (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            PAUSED
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
            <Archive className="w-3 h-3 text-slate-500" />
            COMPLETED
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            {status}
          </span>
        );
    }
  };

  const activeSessions = sessions.filter((s) => s.status !== 'COMPLETED');
  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED');
  const displayedSessions =
    selectedTab === 'active'
      ? activeSessions
      : selectedTab === 'completed'
      ? completedSessions
      : sessions;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-slate-800 font-sans">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span>Collaborative Sessions & Records</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, {user?.name}. Manage active workspaces, invite friends, and view past session history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFriendsModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold transition border border-indigo-200 cursor-pointer shadow-xs"
          >
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Study Buddies & Friends</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Session</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Sessions</p>
            <p className="text-lg font-bold text-slate-900">{sessions.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Rooms</p>
            <p className="text-lg font-bold text-slate-900">{activeSessions.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <History className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Past Records</p>
            <p className="text-lg font-bold text-slate-900">{completedSessions.length}</p>
          </div>
        </div>

        <div
          onClick={() => setShowFriendsModal(true)}
          className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3 cursor-pointer hover:border-indigo-300 transition"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Study Buddies</p>
            <p className="text-xs font-bold text-indigo-600 flex items-center gap-1">Manage Friends &rarr;</p>
          </div>
        </div>
      </div>

      {/* Quick Join Bar */}
      <div className="mb-6 p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Join with Session Code</h3>
            <p className="text-xs text-slate-500">Enter a 6-digit access code (e.g. CSE-XXXXXX) to enter any active session</p>
          </div>
        </div>

        <form onSubmit={handleJoin} className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="e.g. CSE-DEMO26"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="w-full md:w-52 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 uppercase font-mono transition"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition cursor-pointer"
          >
            Enter Room
          </button>
        </form>
      </div>

      {joinError && (
        <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {joinError}
        </div>
      )}

      {deleteFeedback && (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{deleteFeedback}</span>
          </div>
          <button
            onClick={() => setDeleteFeedback(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs for Active vs History Records */}
      <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
        <button
          onClick={() => setSelectedTab('all')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            selectedTab === 'all'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>All Sessions ({sessions.length})</span>
        </button>

        <button
          onClick={() => setSelectedTab('active')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            selectedTab === 'active'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-600" />
          <span>Active Rooms ({activeSessions.length})</span>
        </button>

        <button
          onClick={() => setSelectedTab('completed')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            selectedTab === 'completed'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4 text-amber-500" />
          <span>Session History & Records ({completedSessions.length})</span>
        </button>
      </div>

      {/* Sessions Grid */}
      <div>
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading session records...</div>
        ) : displayedSessions.length === 0 ? (
          <div className="py-16 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-white">
            <Terminal className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">
              {selectedTab === 'completed' ? 'No completed sessions in history' : 'No sessions found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {selectedTab === 'completed'
                ? 'When an interview session is concluded with End Session, it will be archived here with full replay records.'
                : 'Get started by creating a new session or join one using a session code.'}
            </p>
            {selectedTab !== 'completed' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create Your First Session</span>
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
                  className={`bg-white border rounded-xl p-5 transition flex flex-col justify-between hover:shadow-md ${
                    isCompleted
                      ? 'border-slate-200/90 bg-slate-50/40 hover:border-slate-300'
                      : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-indigo-700 font-semibold border border-slate-200">
                          {s.sessionCode}
                        </span>
                        <button
                          onClick={() => handleCopyCode(s.sessionCode)}
                          title="Copy session code"
                          className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                        >
                          {copiedCode === s.sessionCode ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
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
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 line-clamp-1 mb-1">{s.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                      {s.description || 'Collaborative coding and interview session.'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{s.candidateId ? 'Candidate Assigned' : 'Awaiting Collaborator'}</span>
                      </div>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {isHost ? 'Host' : 'Participant'}
                      </span>
                    </div>

                    {/* Action buttons based on completed or active */}
                    {isCompleted ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/sessions/${s.id}/replay`}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition"
                          >
                            <Video className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Watch 10m Replay</span>
                          </Link>
                          <Link
                            to={targetUrl}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
                          >
                            <span>Review Code</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                        <button
                          onClick={() => setSessionToDelete(s)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-xs font-semibold rounded-lg transition cursor-pointer"
                          title="Delete finished session history & record"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Delete History & Record</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => openInviteModal(s.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-slate-500" />
                          <span>Add User</span>
                        </button>

                        <Link
                          to={targetUrl}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                        >
                          <span>{isHost ? 'Manage' : 'Open'}</span>
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-xl w-full shadow-2xl my-8">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Create Collaborative Session</h2>
            <p className="text-xs text-slate-500 mb-4">
              Set up a new code room for peer programming or technical interview evaluation with default .cpp workspace.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Session Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. C++ Algorithms Interview: Dynamic Programming"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief description or interview objectives..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Candidate / Collaborator Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="candidate@example.com"
                  value={newCandidateEmail}
                  onChange={(e) => setNewCandidateEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>

              {/* Questions Section for Interviewer */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Interview Questions & Progressive Reveal
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Include default problems. Hidden questions can be revealed live during the session.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomQuestion(!showAddCustomQuestion)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                  >
                    {showAddCustomQuestion ? '− Close Custom' : '+ Add Custom'}
                  </button>
                </div>

                {/* Preset Questions List */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {questionsList.map((q, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-xs transition ${
                        q.selected ? 'bg-white border-indigo-200 shadow-xs' : 'bg-slate-100/60 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
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
                          <span className="font-semibold text-slate-800 truncate">{q.title}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            q.difficulty === 'EASY' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {q.difficulty}
                          </span>
                        </label>

                        {q.selected && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-400">Initial State:</span>
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
                              {q.status === 'REVEALED' ? 'Revealed' : 'Hidden (Live Reveal)'}
                            </button>
                          </div>
                        )}
                      </div>
                      {q.selected && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 pl-5">
                          {q.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Custom Question Sub-form */}
                {showAddCustomQuestion && (
                  <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2 mt-2">
                    <span className="text-xs font-bold text-slate-900 block">Create Custom Question</span>
                    <input
                      type="text"
                      placeholder="Question Title (e.g. Valid Anagram)"
                      value={customQTitle}
                      onChange={(e) => setCustomQTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                    <textarea
                      rows={2}
                      placeholder="Problem statement / instructions..."
                      value={customQDesc}
                      onChange={(e) => setCustomQDesc(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={customQDiff}
                          onChange={(e: any) => setCustomQDiff(e.target.value)}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800"
                        >
                          <option value="EASY">Easy</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HARD">Hard</option>
                        </select>
                        <select
                          value={customQStatus}
                          onChange={(e: any) => setCustomQStatus(e.target.value)}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800"
                        >
                          <option value="HIDDEN">Initially Hidden (Live Reveal)</option>
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
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded cursor-pointer transition"
                      >
                        Add to Session
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  Create Session (.cpp Default)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Collaborator Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Add Collaborator to Session</h2>
            <p className="text-xs text-slate-500 mb-4">
              Invite another user to join and edit code with you in this session.
            </p>

            {inviteSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                {inviteSuccess}
              </div>
            )}

            <form onSubmit={handleAddParticipant} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Registered User
                </label>
                <select
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                >
                  <option value="">-- Or choose from registered users --</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.name} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Or Enter Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="collaborator@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role in Session</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                >
                  <option value="CANDIDATE">Candidate / Collaborator</option>
                  <option value="INTERVIEWER">Interviewer / Co-Host</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {inviteLoading ? 'Adding...' : 'Add Collaborator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Finished Session Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Session Record?</h3>
                <p className="text-xs text-slate-500">Permanently erase session history and stored artifacts</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Session Title:</span>
                <span className="font-semibold text-slate-800">{sessionToDelete.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Session Code:</span>
                <span className="font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {sessionToDelete.sessionCode}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                  COMPLETED / FINISHED
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 mb-5 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p>
                This will permanently delete this finished session from your history, including all code files, 10-minute screen recording timeline, audit logs, and line timestamps. This action cannot be reversed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteSession}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete Record</span>
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
