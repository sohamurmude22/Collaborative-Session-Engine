import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  sessionService,
  fileService,
  resourceService
} from '../services/api.js';
import { useAuth, useTheme } from '../context/index.js';
import { useSessionSocket } from '../hooks/useSessionSocket.js';
import {
  ISession,
  IFile,
  IQuestion,
  FilePermission
} from '../types/cse.js';
import {
  Lock,
  FileCode,
  Play,
  Terminal,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sparkles,
  Copy,
  Check,
  UserPlus,
  RefreshCw,
  Code2,
  Users,
  ShieldAlert,
  BrainCircuit,
  Info,
  Clock,
  LogOut,
  Sliders,
  Maximize2,
  Minimize2,
  HardDrive,
  MessageSquare,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  SquareTerminal,
  Pencil,
  Plus,
  X
} from 'lucide-react';
import { FriendsModal } from '../components/FriendsModal.js';
import { ThemeSelector } from '../components/ThemeSelector.js';
import { LiveMediaSession } from '../components/LiveMediaSession.js';
import { SessionFileStorage } from '../components/SessionFileStorage.js';
import { SessionChat, ChatMessage } from '../components/SessionChat.js';
import { LineTimestampRecord } from '../components/LineTimestampDrawer.js';

export const CandidateDashboard: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { theme, themeConfig } = useTheme();
  const navigate = useNavigate();

  // Core Data States
  const [session, setSession] = useState<ISession | null>(null);
  const [files, setFiles] = useState<IFile[]>([]);
  const [activeFile, setActiveFile] = useState<IFile | null>(null);
  const [questions, setQuestions] = useState<IQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [lastWsMsg, setLastWsMsg] = useState<any>(null);

  // Dynamic Layout & Customization States
  const [layoutMode, setLayoutMode] = useState<'standard' | 'focus' | 'split' | 'proctor'>('standard');
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showBottomConsole, setShowBottomConsole] = useState(true);
  const [leftTab, setLeftTab] = useState<'files' | 'storage' | 'questions'>('files');
  const [rightTab, setRightTab] = useState<'media' | 'chat'>('media');
  const [editorFontSize, setEditorFontSize] = useState<number>(16);

  // Check if current user is session creator (or interviewer/admin)
  const isCreator =
    (session?.interviewerId as any)?._id === user?.id ||
    (session?.interviewerId as any) === user?.id ||
    user?.role === 'INTERVIEWER' ||
    user?.role === 'ADMIN';

  // Creator file management states
  const [renamingActiveFile, setRenamingActiveFile] = useState(false);
  const [activeFileRenameVal, setActiveFileRenameVal] = useState('');
  const [showAddCppModal, setShowAddCppModal] = useState(false);
  const [newCppName, setNewCppName] = useState('');

  // Line Timestamp History & Millisecond Anti-Cheat States (tracked in backend silently)
  const [lineHistory, setLineHistory] = useState<LineTimestampRecord[]>([]);
  const lastEditTimeRef = useRef<number>(Date.now());
  const prevLineCountRef = useRef<number>(0);

  // In-Session Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  // Proctoring, Warning & Block States
  const [warningAlert, setWarningAlert] = useState<{ message: string; issuerName: string; timestamp: number } | null>(null);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [blockedReason, setBlockedReason] = useState<string>('');
  const [isScreenLocked, setIsScreenLocked] = useState<boolean>(false);
  const [screenLockedReason, setScreenLockedReason] = useState<string>('');

  // Leave Session Confirmation Modal
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Code Execution State
  const [executing, setExecuting] = useState(false);
  const [stdinInput, setStdinInput] = useState('');
  const [execResult, setExecResult] = useState<any>(null);

  // Invite & Friends Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('CANDIDATE');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);

  // Refs for debouncing
  const activeFileRef = useRef<IFile | null>(null);
  activeFileRef.current = activeFile;
  const editTimerRef = useRef<any>(null);
  const lastContentLengthRef = useRef<number>(0);

  // Fetch session details
  const fetchSessionDetails = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await sessionService.getById(sessionId);
      setSession(data);
      if ((data as any).isScreenLocked !== undefined) {
        setIsScreenLocked(Boolean((data as any).isScreenLocked));
        setScreenLockedReason((data as any).screenLockedReason || '');
      }
    } catch (err) {
      console.error('Failed to fetch session:', err);
    }
  }, [sessionId]);

  // Fetch files
  const fetchFiles = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await fileService.getFiles(sessionId);
      setFiles(data);
      if (!activeFileRef.current && data.length > 0) {
        setActiveFile(data[0]);
        lastContentLengthRef.current = data[0].content?.length || 0;
        initializeLineHistory(data[0].content || '');
      } else if (activeFileRef.current) {
        const stillPresent = data.find((f) => f.id === activeFileRef.current!.id);
        if (stillPresent) {
          setActiveFile(stillPresent);
          lastContentLengthRef.current = stillPresent.content?.length || 0;
        } else if (data.length > 0) {
          setActiveFile(data[0]);
          lastContentLengthRef.current = data[0].content?.length || 0;
          initializeLineHistory(data[0].content || '');
        } else {
          setActiveFile(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  }, [sessionId]);

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await resourceService.getQuestions(sessionId);
      setQuestions(data);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    }
  }, [sessionId]);

  // Initialize Line History
  const initializeLineHistory = (content: string) => {
    const lines = content.split('\n');
    prevLineCountRef.current = lines.length;
    const now = Date.now();
    const records: LineTimestampRecord[] = lines.map((text, idx) => ({
      lineNumber: idx + 1,
      text,
      timestamp: now,
      timeFormatted: new Date(now).toLocaleTimeString() + '.' + String(now % 1000).padStart(3, '0'),
      author: 'Initial Code',
      isSuspicious: false
    }));
    setLineHistory(records);
  };

  // WebSocket message handler
  const handleWsMessage = useCallback((msg: any) => {
    setLastWsMsg(msg);
    switch (msg.type) {
      case 'FILE_PERMISSION_CHANGED': {
        const { fileId, fileName, permission, actorName } = msg.payload || {};
        if (fileId && permission) {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, permission } : f))
          );
          if (activeFileRef.current?.id === fileId) {
            setActiveFile((prev) => (prev ? { ...prev, permission } : null));
          }
        }
        setStatusMessage(`File "${fileName || ''}" permission set to [${permission}] by ${actorName || 'Host'}`);
        setTimeout(() => setStatusMessage(null), 3500);
        fetchFiles();
        break;
      }

      case 'FILE_CREATED':
      case 'FILE_RENAMED': {
        fetchFiles();
        if (activeFileRef.current && msg.payload?.fileId === activeFileRef.current.id) {
          setActiveFile((prev) =>
            prev ? { ...prev, name: msg.payload.name, language: msg.payload.language } : prev
          );
        }
        break;
      }

      case 'PERMISSION_ENGINE_LOCKED': {
        const { locked, actorName } = msg.payload || {};
        const targetPerm: FilePermission = locked ? 'LOCKED' : 'VISIBLE_EDITABLE';
        setFiles((prev) => prev.map((f) => ({ ...f, permission: targetPerm })));
        if (activeFileRef.current) {
          setActiveFile((prev) => (prev ? { ...prev, permission: targetPerm } : null));
        }
        setStatusMessage(
          locked
            ? `Permission Engine: Editor locked by ${actorName || 'Host'}.`
            : 'Editor unlocked by Interviewer.'
        );
        setTimeout(() => setStatusMessage(null), 4000);
        fetchFiles();
        break;
      }

      case 'FILE_UPDATED': {
        const { fileId, content } = msg.payload || {};
        if (fileId && content !== undefined) {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, content } : f))
          );
          if (activeFileRef.current?.id === fileId) {
            setActiveFile((prev) => (prev ? { ...prev, content } : null));
          }
        }
        break;
      }

      case 'CHAT_MESSAGE': {
        const newMsg: ChatMessage = msg.payload;
        if (newMsg) {
          setChatMessages((prev) => [...prev, newMsg]);
          if (rightTab !== 'chat') {
            setUnreadChatCount((c) => c + 1);
          }
        }
        break;
      }

      case 'USER_WARNING': {
        const { message, issuerName, timestamp } = msg.payload || {};
        setWarningAlert({
          message: message || 'Warning: Suspicious activity observed.',
          issuerName: issuerName || 'Interviewer',
          timestamp: timestamp || Date.now()
        });
        break;
      }

      case 'USER_BLOCKED': {
        const { targetUserId, reason } = msg.payload || {};
        if (targetUserId === user?.id) {
          setIsBlocked(true);
          setBlockedReason(reason || 'Suspicious activity detected. Access revoked by interviewer.');
        }
        break;
      }

      case 'USER_JOINED': {
        if (msg.payload?.userId === user?.id && msg.payload?.isBlocked === false) {
          setIsBlocked(false);
          setBlockedReason('');
        }
        break;
      }

      case 'SCREEN_LOCKED': {
        const { isScreenLocked: locked, reason } = msg.payload || {};
        setIsScreenLocked(!!locked);
        setScreenLockedReason(reason || (locked ? 'Session screen locked by interviewer.' : ''));
        break;
      }

      case 'CODE_EXECUTED': {
        const { actorName, result } = msg.payload || {};
        if (result) {
          setExecResult(result);
          setStatusMessage(`Code executed by ${actorName || 'Participant'}`);
          setTimeout(() => setStatusMessage(null), 3500);
        }
        break;
      }

      case 'SESSION_RESET': {
        alert('Session has ended and database was reset. Redirecting to dashboard.');
        navigate('/dashboard');
        break;
      }

      case 'AUDIT_EVENT':
        // Silent background telemetry - no alerts shown to candidate
        break;

      case 'QUESTION_REVEALED':
      case 'HINT_REVEALED':
      case 'TESTCASE_REVEALED': {
        const qTitle = msg.payload?.title || 'New Question';
        setStatusMessage(`🎯 Interviewer revealed: ${qTitle}`);
        setTimeout(() => setStatusMessage(null), 4000);
        fetchQuestions();
        break;
      }

      case 'SESSION_STATUS_CHANGED':
        fetchSessionDetails();
        break;

      default:
        break;
    }
  }, [fetchFiles, fetchQuestions, fetchSessionDetails, rightTab, user?.id, navigate]);

  const { isConnected, sendMessage } = useSessionSocket({
    sessionId,
    onMessage: handleWsMessage
  });

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchSessionDetails(), fetchFiles(), fetchQuestions()]);
      setLoading(false);
    };
    init();

    sessionService.getUsersList().then((u) => {
      setAvailableUsers(u.filter((x) => x.id !== user?.id));
    }).catch(() => {});

    return () => {
      if (editTimerRef.current) {
        clearTimeout(editTimerRef.current);
      }
    };
  }, [sessionId, fetchSessionDetails, fetchFiles, fetchQuestions, user?.id]);

  // Derived Permission States
  const isMasterLocked = files.length > 0 && files.every((f) => f.permission === 'LOCKED');
  const isFileLocked = activeFile?.permission === 'LOCKED' || isMasterLocked;
  const isFileReadonly = activeFile?.permission === 'VISIBLE_READONLY';
  const isEditable = !isBlocked && !isScreenLocked && activeFile?.permission === 'VISIBLE_EDITABLE' && session?.status !== 'COMPLETED' && session?.status !== 'PAUSED' && !isMasterLocked;

  // Editor change handler with Line Timestamp History & Millisecond Burst / Anti-Cheat
  const handleEditorChange = (value?: string) => {
    if (!activeFile || value === undefined || isBlocked || !isEditable) return;
    activeFile.content = value;

    const now = Date.now();
    const elapsedMs = now - lastEditTimeRef.current;
    lastEditTimeRef.current = now;

    const prevLen = lastContentLengthRef.current;
    const currentLen = value.length;
    const diff = currentLen - prevLen;
    lastContentLengthRef.current = currentLen;

    const currentLines = value.split('\n');
    const lineDiff = currentLines.length - prevLineCountRef.current;
    prevLineCountRef.current = currentLines.length;

    // Detect millisecond burst or large paste operation
    // If >25 chars inserted in <60ms or >2 lines inserted instantaneously
    const isMillisecondBurst = (diff > 25 && elapsedMs < 60) || (lineDiff > 2 && elapsedMs < 100);

    if (isMillisecondBurst) {
      // Alert the system & interviewer via WebSocket silently (no alert shown to candidate)
      sendMessage('SUSPICIOUS_ACTIVITY', {
        fileId: activeFile.id,
        eventType: 'BURST_PASTE_DETECTED',
        details: {
          elapsedMs,
          insertedChars: diff,
          linesAdded: lineDiff,
          lineNumber: currentLines.length,
          preview: value.slice(Math.max(0, currentLen - diff - 50), currentLen),
          alert: `🚨 Suspicious Activity: Rapid paste detected from candidate ${user?.name || 'Candidate'} (+${diff} chars in ${elapsedMs}ms)!`
        }
      });
    }

    // Update line timestamp history
    const updatedRecords: LineTimestampRecord[] = currentLines.map((text, idx) => {
      const existing = lineHistory[idx];
      const isChanged = !existing || existing.text !== text;
      return {
        lineNumber: idx + 1,
        text,
        timestamp: isChanged ? now : existing?.timestamp || now,
        timeFormatted: isChanged
          ? new Date(now).toLocaleTimeString() + '.' + String(now % 1000).padStart(3, '0')
          : existing?.timeFormatted || new Date(now).toLocaleTimeString(),
        author: isChanged ? (user?.name || 'Candidate') : existing?.author || 'Initial Code',
        isSuspicious: isChanged && isMillisecondBurst ? true : existing?.isSuspicious || false,
        burstSpeedMs: isChanged && isMillisecondBurst ? elapsedMs : existing?.burstSpeedMs
      };
    });
    setLineHistory(updatedRecords);

    // Debounce save / sync
    if (editTimerRef.current) {
      clearTimeout(editTimerRef.current);
    }

    editTimerRef.current = setTimeout(() => {
      sendMessage('FILE_EDIT_PING', {
        fileId: activeFile.id,
        content: value,
        delta: isMillisecondBurst ? value.slice(prevLen, currentLen) : '',
        isPaste: isMillisecondBurst
      });
    }, 40);
  };

  // Capture paste directly from Monaco
  const handleEditorDidMount = (editor: any) => {
    editor.onDidPaste((e: any) => {
      const selection = editor.getSelection();
      const lineNum = selection ? selection.startLineNumber : 1;
      const model = editor.getModel();
      const pastedText = model ? model.getValueInRange(e.range) : '';
      const charLen = pastedText ? pastedText.length : 0;

      // Silent telemetry to alert interviewer with red notification
      sendMessage('SUSPICIOUS_ACTIVITY', {
        fileId: activeFile?.id,
        eventType: 'BURST_PASTE_DETECTED',
        details: {
          isPaste: true,
          lineNumber: lineNum,
          insertedChars: charLen,
          preview: pastedText.slice(0, 100),
          alert: `🚨 Suspicious Activity: Copy-Paste detected from candidate ${user?.name || 'Candidate'} on Line ${lineNum} (+${charLen} chars)!`
        }
      });

      sendMessage('FILE_EDIT_PING', {
        fileId: activeFile?.id,
        content: model ? model.getValue() : activeFile?.content,
        delta: pastedText,
        isPaste: true,
        lineNumber: lineNum
      });
    });
  };

  // Live line timestamp telemetry heartbeat every second
  useEffect(() => {
    if (!activeFile || !sessionId) return;
    const interval = setInterval(() => {
      if (lineHistory.length > 0) {
        sendMessage('LINE_TIMESTAMPS_UPDATE', {
          fileId: activeFile.id,
          lines: lineHistory
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeFile?.id, sessionId, lineHistory, sendMessage]);

  const handleRenameActiveFile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeFile || !activeFileRenameVal.trim()) return;
    try {
      let cleanName = activeFileRenameVal.trim();
      if (!cleanName.includes('.')) {
        cleanName += '.cpp';
      }
      await fileService.renameFile(activeFile.id, cleanName);
      setRenamingActiveFile(false);
      fetchFiles();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to rename file.');
    }
  };

  const handleCreateNewCpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCppName.trim() || !sessionId) return;
    try {
      let cleanName = newCppName.trim();
      if (!cleanName.includes('.')) {
        cleanName += '.cpp';
      }
      await fileService.createFile(sessionId, {
        name: cleanName,
        language: 'cpp',
        content: `// ${cleanName}\n#include <iostream>\n\n`,
        permission: 'VISIBLE_EDITABLE'
      });
      setNewCppName('');
      setShowAddCppModal(false);
      fetchFiles();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to create .cpp file.');
    }
  };

  // Run C++ or other language code
  const handleRunCode = async () => {
    if (!sessionId || !activeFile) return;
    setExecuting(true);
    setExecResult(null);

    try {
      const result = await sessionService.executeCode(sessionId, {
        fileId: activeFile.id,
        code: activeFile.content,
        language: activeFile.language,
        stdinInput
      });
      setExecResult(result);
    } catch (err: any) {
      setExecResult({
        status: 'RUNTIME_ERROR',
        stderr: err.response?.data?.error?.message || 'Execution error during compilation or run.'
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleCopyCode = () => {
    if (session?.sessionCode) {
      navigator.clipboard.writeText(session.sessionCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Leave Session & Reset Database handler
  const handleLeaveSession = async () => {
    if (!sessionId) return;
    try {
      setLeaving(true);
      await sessionService.leave(sessionId, true);
      navigate('/dashboard');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to cleanly exit session.');
      navigate('/dashboard');
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  // Send in-session chat message
  const handleSendChatMessage = (text: string) => {
    sendMessage('CHAT_MESSAGE', {
      message: text
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-semibold">Connecting to collaborative session...</p>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-64px)] flex flex-col ${themeConfig.bgPage} text-slate-800 overflow-hidden font-sans transition-colors duration-200 relative`}>
      {/* Real-time Status Alert Banner */}
      {statusMessage && (
        <div className="bg-indigo-600 text-white px-4 py-1.5 text-xs text-center font-medium shadow-sm animate-fade-in shrink-0">
          {statusMessage}
        </div>
      )}

      {/* Interviewer Warning Alert Modal / Toast */}
      {warningAlert && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-lg shrink-0 border-b border-amber-600 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-slate-950" />
            <span>
              <strong>Warning from {warningAlert.issuerName}:</strong> {warningAlert.message}
            </span>
          </div>
          <button
            onClick={() => setWarningAlert(null)}
            className="px-2 py-0.5 rounded bg-slate-950 text-white text-[11px] font-semibold hover:bg-slate-800 cursor-pointer ml-4"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Full-Screen Screen Locked Overlay Modal */}
      {isScreenLocked && !isBlocked && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Screen Locked by Interviewer</h2>
            <p className="text-xs text-amber-300 font-semibold mb-4 leading-relaxed">
              {screenLockedReason || 'The interviewer has locked your session screen and editor.'}
            </p>
            <p className="text-xs text-slate-400 mb-6">
              All editor inputs and interactions are temporarily suspended. Please await instructions from your interviewer.
            </p>
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium rounded-xl text-xs border border-slate-700 transition cursor-pointer flex items-center justify-center gap-2 mx-auto"
            >
              <LogOut className="w-3.5 h-3.5" /> Leave Session
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Suspended / Blocked Overlay Modal */}
      {isBlocked && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Suspended</h2>
            <p className="text-xs text-rose-300 font-semibold mb-4 leading-relaxed">
              {blockedReason || 'You have been blocked by the interviewer for suspicious activity.'}
            </p>
            <p className="text-xs text-slate-400 mb-6">
              Your code editor input permissions have been frozen. Please explain the activity to the interviewer or leave the session.
            </p>
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Leave Session
            </button>
          </div>
        </div>
      )}

      {/* Top Session Ribbon */}
      <div className={`h-14 border-b border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#090d16]/85 backdrop-blur-xl px-4 flex items-center justify-between shadow-xs transition-colors duration-200 shrink-0`}>
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${themeConfig.accent} shadow-[0_0_8px_rgba(99,102,241,0.5)]`} />
            <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-xs md:max-w-sm font-heading">
              {session?.title}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/20">
              {session?.sessionCode}
            </span>
            <button
              onClick={handleCopyCode}
              title="Copy session code to share"
              className="p-1 text-slate-400 hover:text-indigo-500 rounded-lg transition cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pl-2 border-l border-slate-200 dark:border-white/10 shrink-0">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
            <span className="font-mono text-[11px]">{isConnected ? 'Sync Active' : 'Connecting...'}</span>
          </div>
        </div>

        {/* Dynamic Layout & Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Layout Mode Selector */}
          <div className="hidden lg:flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <button
              onClick={() => {
                setLayoutMode('standard');
                setShowLeftSidebar(true);
                setShowRightSidebar(true);
                setShowBottomConsole(true);
              }}
              className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                layoutMode === 'standard' ? 'bg-white dark:bg-white/10 shadow-xs text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => {
                setLayoutMode('focus');
                setShowLeftSidebar(false);
                setShowRightSidebar(false);
                setShowBottomConsole(false);
              }}
              className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                layoutMode === 'focus' ? 'bg-white dark:bg-white/10 shadow-xs text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Focus Code
            </button>
            <button
              onClick={() => {
                setLayoutMode('split');
                setShowLeftSidebar(false);
                setShowRightSidebar(false);
                setShowBottomConsole(true);
              }}
              className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                layoutMode === 'split' ? 'bg-white dark:bg-white/10 shadow-xs text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Split View
            </button>
          </div>

          {/* Theme Selector */}
          <ThemeSelector compact={true} />

          {/* Leave Session Button */}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-xs font-bold transition shadow-xs cursor-pointer"
            title="Leave session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave Room</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Files / Shared File Storage / Problems */}
        {showLeftSidebar && (
          <div className={`w-72 md:w-80 border-r border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-[#070b14] flex flex-col shrink-0 transition-all duration-200`}>
            {/* Left Column Tabs */}
            <div className="p-2 border-b border-slate-200/80 dark:border-white/10 bg-slate-100/60 dark:bg-black/30 flex gap-1">
              <button
                onClick={() => setLeftTab('files')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  leftTab === 'files'
                    ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-white/10'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" /> Files ({files.length})
              </button>

              <button
                onClick={() => setLeftTab('storage')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  leftTab === 'storage'
                    ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-white/10'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5 text-indigo-500" /> Storage
              </button>
            </div>

            {/* Tab 1: File List */}
            {leftTab === 'files' && (
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {files.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No files found in session.
                  </div>
                ) : (
                  files.map((file) => {
                    const isActive = activeFile?.id === file.id;
                    const isLocked = file.permission === 'LOCKED' || isMasterLocked;
                    const isReadonly = file.permission === 'VISIBLE_READONLY';

                    return (
                      <button
                        key={file.id}
                        onClick={() => {
                          setActiveFile(file);
                          lastContentLengthRef.current = file.content?.length || 0;
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left border text-xs transition cursor-pointer ${
                          isActive
                            ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-900 dark:text-indigo-300 font-bold shadow-xs'
                            : 'bg-white/70 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileCode className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                          <span className="truncate">{file.name}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isLocked ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> LOCKED
                            </span>
                          ) : isReadonly ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1">
                              <Eye className="w-2.5 h-2.5" /> READ-ONLY
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                              <Code2 className="w-2.5 h-2.5" /> EDITABLE
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab 2: Shared File Storage Section (Visible to all) */}
            {leftTab === 'storage' && (
              <div className="flex-1 p-2 overflow-hidden">
                <SessionFileStorage
                  sessionId={sessionId!}
                  files={files}
                  activeFileId={activeFile?.id}
                  isInterviewer={false}
                  isCreator={isCreator}
                  onSelectFile={(f) => setActiveFile(f)}
                  onRefreshFiles={fetchFiles}
                  onFileCreated={fetchFiles}
                />
              </div>
            )}
          </div>
        )}

        {/* Center Column: Monaco Editor & C++ Compiler Output Console */}
        <div className={`flex-1 flex flex-col ${themeConfig.bgCard} relative overflow-hidden transition-colors duration-200`}>
          {/* Editor Header Toolbar */}
          <div className="h-10 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.02] px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowLeftSidebar(!showLeftSidebar)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
                title="Toggle Left Sidebar"
              >
                {showLeftSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>

              {renamingActiveFile && activeFile ? (
                <form onSubmit={handleRenameActiveFile} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={activeFileRenameVal}
                    onChange={(e) => setActiveFileRenameVal(e.target.value)}
                    autoFocus
                    className="px-2 py-0.5 text-xs font-mono bg-white dark:bg-[#090d16] border border-indigo-500 rounded text-slate-900 dark:text-white focus:outline-none"
                    placeholder="filename.cpp"
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingActiveFile(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                    {activeFile ? activeFile.name : 'No file selected'}
                  </span>

                  {isCreator && activeFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFileRenameVal(activeFile.name);
                        setRenamingActiveFile(true);
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-500 transition cursor-pointer"
                      title="Rename Active File"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {isFileLocked ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                  <Lock className="w-3 h-3 text-rose-500" /> Locked
                </span>
              ) : isFileReadonly ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Eye className="w-3 h-3 text-amber-500" /> Read-Only
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Live Editable
                </span>
              )}
            </div>

            {/* Editor Right Toolbar: Font Controls, Add .cpp & Run Code */}
            <div className="flex items-center gap-2">
              {isCreator && (
                <button
                  type="button"
                  onClick={() => {
                    setNewCppName(`file_${files.length + 1}.cpp`);
                    setShowAddCppModal(true);
                  }}
                  className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-500/20 transition cursor-pointer"
                  title="Add New .cpp File"
                >
                  <Plus className="w-3 h-3" />
                  <span>New .cpp</span>
                </button>
              )}

              <div className="hidden sm:flex items-center gap-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-0.5 text-slate-600 dark:text-slate-300">
                <button
                  onClick={() => setEditorFontSize((s) => Math.max(12, s - 1))}
                  className="p-1 hover:text-indigo-500 cursor-pointer"
                  title="Decrease Font Size"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <span className="text-xs font-mono px-1 font-bold text-slate-800 dark:text-slate-200">{editorFontSize}px</span>
                <button
                  onClick={() => setEditorFontSize((s) => Math.min(26, s + 1))}
                  className="p-1 hover:text-indigo-500 cursor-pointer"
                  title="Increase Font Size"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={() => setShowBottomConsole(!showBottomConsole)}
                className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                  showBottomConsole
                    ? 'bg-slate-200 dark:bg-white/15 text-slate-900 dark:text-white border-slate-300 dark:border-white/20'
                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-50'
                }`}
                title="Toggle Console Output"
              >
                <SquareTerminal className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-xs font-medium">Console</span>
              </button>

              <button
                onClick={handleRunCode}
                disabled={executing || !activeFile}
                className="flex items-center gap-1.5 px-3.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 shadow-xs shadow-emerald-600/25 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{executing ? 'Compiling...' : 'Run C++'}</span>
              </button>

              <button
                onClick={() => setShowRightSidebar(!showRightSidebar)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
                title="Toggle Right Panel"
              >
                {showRightSidebar ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Monaco Editor Canvas */}
          <div className="flex-1 relative overflow-hidden bg-white dark:bg-[#090d16]">
            {activeFile ? (
              <Editor
                height="100%"
                theme={themeConfig.monacoTheme}
                language={activeFile.language === 'cpp' ? 'cpp' : activeFile.language === 'python' ? 'python' : 'javascript'}
                value={activeFile.content}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                options={{
                  fontSize: editorFontSize,
                  lineNumbers: 'on',
                  minimap: { enabled: false },
                  readOnly: !isEditable || isBlocked || isScreenLocked,
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  tabSize: 2,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2">
                <FileCode className="w-8 h-8 text-slate-300" />
                <span>Select a file from the storage or files panel</span>
              </div>
            )}
          </div>

          {/* Working C++ Compiler Console / Terminal */}
          {showBottomConsole && (
            <div className="h-64 border-t border-slate-800 bg-slate-950 text-slate-100 flex flex-col shrink-0">
              <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">
                    C++ Compiler Output & Stdin Console
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {execResult && (
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold ${
                        execResult.status === 'SUCCESS'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : 'bg-rose-950 text-rose-300 border border-rose-700'
                      }`}
                    >
                      {execResult.status} ({execResult.executionTime}ms, exit: {execResult.exitCode})
                    </span>
                  )}
                  <button
                    onClick={() => setExecResult(null)}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer px-2 py-0.5 bg-slate-800 rounded hover:bg-slate-700 transition"
                  >
                    Clear Output
                  </button>
                </div>
              </div>

              {/* Console Body: Stdin Input + Output */}
              <div className="flex-1 flex overflow-hidden">
                {/* Standard Input panel for interactive C++ programs */}
                <div className="w-56 md:w-64 border-r border-slate-800 p-2.5 flex flex-col shrink-0 bg-slate-900/40">
                  <label className="text-[11px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                    <SquareTerminal className="w-3 h-3 text-indigo-400" />
                    <span>Interactive Stdin (cin):</span>
                  </label>
                  <textarea
                    value={stdinInput}
                    onChange={(e) => setStdinInput(e.target.value)}
                    placeholder="Inputs for cin (e.g. 5 10)..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                {/* Stdout / Stderr display */}
                <div className="flex-1 p-3.5 overflow-y-auto font-mono text-sm leading-relaxed custom-scrollbar bg-slate-950/80">
                  {executing ? (
                    <div className="flex items-center gap-2 text-indigo-400 animate-pulse text-sm">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Compiling C++ with MinGW g++ and running executable...</span>
                    </div>
                  ) : execResult ? (
                    <div className="space-y-2">
                      {execResult.stdout && (
                        <div className="text-emerald-300 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                          {execResult.stdout}
                        </div>
                      )}
                      {execResult.stderr && (
                        <div className="text-rose-400 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                          {execResult.stderr}
                        </div>
                      )}
                      {!execResult.stdout && !execResult.stderr && (
                        <div className="text-slate-500 italic text-sm">
                          (Program executed successfully with no output)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-500 italic text-xs">
                      Click &quot;Run C++ Code&quot; to compile and execute current file. Output will appear here.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Camera & Microphone Video Feed + In-Session Live Chat */}
        {showRightSidebar && (
          <div className={`w-80 md:w-96 border-l border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-[#070b14] flex flex-col overflow-hidden shrink-0 transition-all duration-200`}>
            {/* Right Tabs: Live Media vs In-Session Chat */}
            <div className="p-2 border-b border-slate-200/80 dark:border-white/10 bg-slate-100/60 dark:bg-black/30 flex gap-1 shrink-0">
              <button
                onClick={() => setRightTab('media')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightTab === 'media'
                    ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-white/10'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Live Feed & Problems</span>
              </button>

              <button
                onClick={() => {
                  setRightTab('chat');
                  setUnreadChatCount(0);
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 relative ${
                  rightTab === 'chat'
                    ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-white/10'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
                {unreadChatCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-mono font-bold">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            </div>

            {/* Right Content Tab 1: Live Video Feed & Questions */}
            {rightTab === 'media' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Camera & Microphone Session Feed */}
                <LiveMediaSession
                  sessionId={sessionId!}
                  currentUserId={user?.id || ''}
                  currentUserName={user?.name || 'Candidate'}
                  currentUserRole={user?.role || 'CANDIDATE'}
                  currentUserAvatarUrl={user?.avatarUrl}
                  sendMessage={sendMessage}
                  lastSocketMessage={lastWsMsg}
                />

                {/* Problems & Revealed Hints Section */}
                <div className="p-4 rounded-2xl bg-white/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-heading">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Problems & Hints
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                      {questions.length} Active
                    </span>
                  </div>

                  {questions.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 text-xs text-slate-400 text-center">
                      Questions will appear once revealed by the host.
                    </div>
                  ) : (
                    questions.map((q) => (
                      <div key={q.id} className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm font-heading">{q.title}</h4>
                          <span
                            className={`text-[9px] font-mono font-bold px-2 py-0.2 rounded-full ${
                              q.difficulty === 'EASY'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                                : q.difficulty === 'HARD'
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
                            }`}
                          >
                            {q.difficulty || 'MEDIUM'}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{q.description}</p>

                        {/* Revealed Hints */}
                        {q.hints && q.hints.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 dark:border-white/10 space-y-1.5">
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-500" /> Hints ({q.hints.length}):
                            </span>
                            {q.hints.map((h) => (
                              <div key={h.id} className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                                <p className="font-bold text-[11px] mb-0.5">{h.title}</p>
                                <p className="text-[11px] leading-snug">{h.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Right Content Tab 2: In-Session Live Chat */}
            {rightTab === 'chat' && (
              <div className="flex-1 p-2 overflow-hidden">
                <SessionChat
                  sessionId={sessionId!}
                  currentUserId={user?.id || ''}
                  currentUserName={user?.name || 'Candidate'}
                  currentUserRole={user?.role || 'CANDIDATE'}
                  currentUserAvatarUrl={user?.avatarUrl}
                  messages={chatMessages}
                  onSendMessage={handleSendChatMessage}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Leave Session Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Leave Session?</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Leaving the session will conclude your interview. The session database will be reset and demo accounts removed.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={leaving}
                onClick={handleLeaveSession}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {leaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                <span>{leaving ? 'Leaving...' : 'Confirm Leave'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New .cpp File Modal for Creator */}
      {showAddCppModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Add New .cpp File</h3>
            <p className="text-xs text-slate-500 mb-3">
              Add a new .cpp source code file to your collaborative session.
            </p>
            <form onSubmit={handleCreateNewCpp} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">File Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. solution.cpp, helper.cpp"
                  value={newCppName}
                  onChange={(e) => setNewCppName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCppModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow-xs"
                >
                  Create .cpp File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
