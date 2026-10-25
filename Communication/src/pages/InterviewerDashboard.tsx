import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  sessionService,
  fileService,
  resourceService
} from '../services/api.js';
import { useAuth, useTheme } from '../context/index.js';
import { useSessionSocket } from '../hooks/useSessionSocket.js';
import { FriendsModal } from '../components/FriendsModal.js';
import { ThemeSelector } from '../components/ThemeSelector.js';
import { LiveMediaSession } from '../components/LiveMediaSession.js';
import { UserAvatar } from '../components/UserAvatar.js';
import { sessionRecordingService } from '../services/sessionRecording.js';
import {
  ISession,
  IFile,
  IQuestion,
  IHint,
  ITestCase,
  IAuditLog,
  FilePermission
} from '../types/cse.js';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  FileCode,
  Plus,
  Play,
  Pause,
  StopCircle,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  History,
  Terminal,
  Activity,
  Users,
  Send,
  Sparkles,
  Copy,
  Check,
  UserPlus,
  RefreshCw,
  Edit3,
  Trash2,
  Lightbulb,
  X,
  Sliders,
  Save,
  CheckCircle2,
  ArrowRight,
  Archive,
  Timer,
  Clock,
  Award,
  Star,
  FileText,
  BrainCircuit,
  Compass,
  BookmarkCheck,
  Gauge,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FolderArchive,
  Download,
  Code2,
  Radio,
  LogOut,
  Maximize2,
  Minimize2,
  HardDrive,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  SquareTerminal,
  UserCheck,
  UserX,
  AlertOctagon,
  Pencil
} from 'lucide-react';
import { SessionFileStorage } from '../components/SessionFileStorage.js';
import { SessionChat, ChatMessage } from '../components/SessionChat.js';
import { LineTimestampDrawer, LineTimestampRecord } from '../components/LineTimestampDrawer.js';

export const InterviewerDashboard: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<ISession | null>(null);
  const [files, setFiles] = useState<IFile[]>([]);
  const [activeFile, setActiveFile] = useState<IFile | null>(null);
  const [questions, setQuestions] = useState<IQuestion[]>([]);
  const [auditLogs, setAuditLogs] = useState<IAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [lastWsMsg, setLastWsMsg] = useState<any>(null);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Master Lock Engine State
  const [lockLoading, setLockLoading] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);

  // File Creation Modal
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileLang, setNewFileLang] = useState('cpp');
  const [newFilePerm, setNewFilePerm] = useState<FilePermission>('VISIBLE_EDITABLE');

  // Question Creation / Change Modal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<IQuestion | null>(null);
  const [questionTitle, setQuestionTitle] = useState('');
  const [questionDesc, setQuestionDesc] = useState('');
  const [questionDifficulty, setQuestionDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [questionLoading, setQuestionLoading] = useState(false);

  // Hint Creation Modal
  const [showHintModal, setShowHintModal] = useState(false);
  const [hintQuestionId, setHintQuestionId] = useState<string | null>(null);
  const [hintTitle, setHintTitle] = useState('');
  const [hintContent, setHintContent] = useState('');
  const [hintLoading, setHintLoading] = useState(false);

  // End Session Modals
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false);
  const [showEndedSummary, setShowEndedSummary] = useState(false);
  const [endingSession, setEndingSession] = useState(false);

  // Friends & Collaborator Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('CANDIDATE');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);

  // Execution state
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);

  // Notification message
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Refs for activeFile & debouncing
  const activeFileRef = useRef<IFile | null>(null);
  activeFileRef.current = activeFile;
  const editTimerRef = useRef<any>(null);
  const httpSaveTimerRef = useRef<any>(null);

  // Derived Master Lock Status: true if all files are locked
  const isMasterLocked = files.length > 0 && files.every((f) => f.permission === 'LOCKED');

  // Check if current user is the session creator / host or admin
  const isCreator = user?.role === 'ADMIN' || Boolean(
    session?.interviewerId && (
      (typeof session.interviewerId === 'string' && session.interviewerId === user?.id) ||
      ((session.interviewerId as any)?._id === user?.id) ||
      ((session.interviewerId as any)?.id === user?.id)
    )
  );

  const { theme, themeConfig } = useTheme();

  // Extra Interviewer Tools: Stopwatch & Phased Milestones
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [interviewPhase, setInterviewPhase] = useState<number>(1);

  // Extra Interviewer Tools: Evaluation Scorecard & Rubric
  const [showRubricModal, setShowRubricModal] = useState(false);
  const [rubricScores, setRubricScores] = useState({
    problemSolving: 4,
    algorithm: 4,
    codeQuality: 4,
    testing: 3,
    communication: 4
  });
  const [privateNotes, setPrivateNotes] = useState(() => {
    return localStorage.getItem(`interviewer_notes_${sessionId}`) || '';
  });
  const [copiedRubric, setCopiedRubric] = useState(false);

  // Educational Complexity Tracker
  const [targetTimeComplexity, setTargetTimeComplexity] = useState('O(N)');
  const [targetSpaceComplexity, setTargetSpaceComplexity] = useState('O(1)');

  // Candidate Live Status
  const [candidateActivity, setCandidateActivity] = useState<'idle' | 'typing' | 'running'>('idle');
  const candidateActivityTimerRef = useRef<any>(null);

  // Layout Controls & Dynamic Customization
  const [layoutMode, setLayoutMode] = useState<'standard' | 'focus' | 'split' | 'proctor'>('standard');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<'files' | 'storage' | 'questions'>('files');
  const [rightTab, setRightTab] = useState<'proctor' | 'media' | 'chat'>('proctor');
  const [showBottomConsole, setShowBottomConsole] = useState(true);
  const [showTimestampDrawer, setShowTimestampDrawer] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState<number>(16);

  // Line Timestamp History & Millisecond Anti-Cheat States
  const [lineHistory, setLineHistory] = useState<LineTimestampRecord[]>([]);
  const [suspiciousAlert, setSuspiciousAlert] = useState<{
    message: string;
    actorName?: string;
    charCount?: number;
    lineNumber?: number;
    preview?: string;
    timestamp?: number;
  } | null>(null);

  // File rename states
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [renamingActiveFile, setRenamingActiveFile] = useState<boolean>(false);
  const [activeRenameVal, setActiveRenameVal] = useState<string>('');

  const lastEditTimeRef = useRef<number>(Date.now());
  const prevLineCountRef = useRef<number>(0);
  const lastContentLengthRef = useRef<number>(0);

  // In-Session Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  // Leave Session Modal State
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Proctor Warning & Blocking Modals
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningText, setWarningText] = useState('Suspicious activity observed. Please adhere to session guidelines.');
  const [warningTargetUserId, setWarningTargetUserId] = useState('');
  const [warningTargetUserName, setWarningTargetUserName] = useState('');
  const [warningLoading, setWarningLoading] = useState(false);

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('Rapid code insertion / paste detected. Access suspended.');
  const [blockTargetUserId, setBlockTargetUserId] = useState('');
  const [blockTargetUserName, setBlockTargetUserName] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);

  // Execution Stdin Input
  const [stdinInput, setStdinInput] = useState('');

  // Session File Storage Drawer / Modal state
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [storageData, setStorageData] = useState<any>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [storageSelectedFile, setStorageSelectedFile] = useState<any>(null);
  const [storageCopied, setStorageCopied] = useState(false);

  const handleOpenStorageModal = async () => {
    setShowStorageModal(true);
    if (!sessionId) return;
    try {
      setLoadingStorage(true);
      const data = await fileService.getSessionStorage(sessionId);
      setStorageData(data);
      if (data?.files?.length > 0) {
        setStorageSelectedFile(data.files[0]);
      }
    } catch (err: any) {
      console.error('Failed to load session storage:', err);
    } finally {
      setLoadingStorage(false);
    }
  };

  const handleDownloadSingleStorageFile = (fileObj: any) => {
    if (!fileObj) return;
    const blob = new Blob([fileObj.content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileObj.name || 'file.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllStorageFiles = () => {
    if (!storageData?.files?.length) return;
    const bundle = {
      sessionId,
      sessionTitle: session?.title,
      sessionCode: session?.sessionCode,
      exportedAt: new Date().toISOString(),
      files: storageData.files.map((f: any) => ({
        name: f.name,
        language: f.language,
        content: f.content,
        permission: f.permission,
        sizeBytes: f.sizeBytes,
        lineCount: f.lineCount
      }))
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Session_${session?.sessionCode || sessionId}_Files_Archive.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyStorageContent = (content: string) => {
    navigator.clipboard.writeText(content);
    setStorageCopied(true);
    setTimeout(() => setStorageCopied(false), 2000);
  };

  useEffect(() => {
    let interval: any = null;
    if (stopwatchRunning) {
      interval = setInterval(() => {
        setStopwatchSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [stopwatchRunning]);

  const formatStopwatch = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs > 0 ? `${hrs.toString().padStart(2, '0')}:` : ''}${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveNotes = (notes: string) => {
    setPrivateNotes(notes);
    if (sessionId) {
      localStorage.setItem(`interviewer_notes_${sessionId}`, notes);
    }
  };

  const handleCopyRubric = () => {
    const totalScore = Object.values(rubricScores).reduce((a, b) => a + b, 0);
    const text = `## Interview Evaluation Assessment - ${session?.title || 'Session'}
**Total Score**: ${totalScore} / 25
- Problem Solving & Formulation: ${rubricScores.problemSolving} / 5
- Algorithm & Big-O Tradeoffs: ${rubricScores.algorithm} / 5
- Code Quality & Clean Syntax: ${rubricScores.codeQuality} / 5
- Edge Case & Self-Testing: ${rubricScores.testing} / 5
- Technical Communication: ${rubricScores.communication} / 5

**Target Complexity**: Time ${targetTimeComplexity} | Space ${targetSpaceComplexity}

### Private Interviewer Notes
${privateNotes || 'No notes added.'}`;

    navigator.clipboard.writeText(text);
    setCopiedRubric(true);
    setTimeout(() => setCopiedRubric(false), 2000);
  };

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

  const fetchSessionDetails = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await sessionService.getById(sessionId);
      setSession(data);
      if ((data as any).isScreenLocked !== undefined) {
        setIsScreenLocked(Boolean((data as any).isScreenLocked));
      }
    } catch (err) {
      console.error(err);
    }
  }, [sessionId]);

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
        const updated = data.find((f) => f.id === activeFileRef.current!.id);
        if (updated) {
          setActiveFile(updated);
          lastContentLengthRef.current = updated.content?.length || 0;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [sessionId]);

  const fetchQuestions = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await resourceService.getQuestions(sessionId);
      setQuestions(data);
    } catch (err) {
      console.error(err);
    }
  }, [sessionId]);

  const fetchLogs = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await sessionService.getAuditLogs(sessionId);
      setAuditLogs(data.slice(0, 50));
    } catch (err) {
      console.error(err);
    }
  }, [sessionId]);

  // WebSocket message handler
  const handleWsMessage = useCallback(
    (msg: any) => {
      setLastWsMsg(msg);
      switch (msg.type) {
        case 'USER_JOINED':
        case 'USER_LEFT':
          fetchSessionDetails();
          break;

        case 'FILE_CREATED':
        case 'FILE_RENAMED':
        case 'FILE_PERMISSION_CHANGED':
        case 'PERMISSION_ENGINE_LOCKED':
          fetchFiles();
          if (activeFileRef.current && activeFileRef.current.id === msg.payload?.fileId) {
            setActiveFile((prev) =>
              prev ? { ...prev, name: msg.payload?.name || prev.name, language: msg.payload?.language || prev.language } : prev
            );
          }
          break;

        case 'FILE_UPDATED': {
          const { fileId, content } = msg.payload || {};
          if (fileId && content !== undefined) {
            setFiles((prev) =>
              prev.map((f) => (f.id === fileId ? { ...f, content } : f))
            );
            if (activeFileRef.current?.id === fileId) {
              setActiveFile((prev) => (prev ? { ...prev, content } : null));
              // Update line history with candidate lines
              const lines = content.split('\n');
              const now = Date.now();
              const records: LineTimestampRecord[] = lines.map((text: string, idx: number) => ({
                lineNumber: idx + 1,
                text,
                timestamp: now,
                timeFormatted: new Date(now).toLocaleTimeString() + '.' + String(now % 1000).padStart(3, '0'),
                author: 'Candidate',
                isSuspicious: false
              }));
              setLineHistory(records);
            }
          }
          setCandidateActivity('typing');
          if (candidateActivityTimerRef.current) clearTimeout(candidateActivityTimerRef.current);
          candidateActivityTimerRef.current = setTimeout(() => setCandidateActivity('idle'), 2500);
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

        case 'SUSPICIOUS_ACTIVITY_ALERT':
        case 'SUSPICIOUS_ACTIVITY':
        case 'BURST_PASTE_DETECTED': {
          const payload = msg.payload || {};
          const details = payload.details || payload;
          const alertMsg =
            details.message ||
            details.alert ||
            `🚨 Suspicious Activity: Copy-Paste detected from candidate ${payload.actorName || details.actorName || 'Candidate'}!`;
          setSuspiciousAlert({
            message: alertMsg,
            actorName: payload.actorName || details.actorName || 'Candidate',
            charCount: details.charCount || details.insertedChars || details.characters || 0,
            lineNumber: details.lineNumber || 1,
            preview: details.preview || '',
            timestamp: details.timestamp || Date.now()
          });
          setBannerNotice(alertMsg);
          fetchLogs();
          break;
        }

        case 'LINE_TIMESTAMPS_UPDATE': {
          if (msg.payload?.lines && Array.isArray(msg.payload.lines)) {
            setLineHistory(msg.payload.lines);
          }
          break;
        }



        case 'USER_WARNING': {
          const { message, issuerName } = msg.payload || {};
          setBannerNotice(`Warning dispatched by ${issuerName || 'Host'}: ${message || ''}`);
          setTimeout(() => setBannerNotice(null), 4000);
          break;
        }

        case 'USER_BLOCKED': {
          fetchSessionDetails();
          fetchFiles();
          setBannerNotice(`Participant was blocked for suspicious activity.`);
          setTimeout(() => setBannerNotice(null), 4000);
          break;
        }

        case 'SCREEN_LOCKED': {
          const { isScreenLocked: locked } = msg.payload || {};
          setIsScreenLocked(!!locked);
          break;
        }

        case 'CODE_EXECUTED': {
          const { actorName, result } = msg.payload || {};
          if (result) {
            setExecResult(result);
            setBannerNotice(`Code executed by ${actorName || 'Participant'}`);
            setTimeout(() => setBannerNotice(null), 3500);
          }
          break;
        }

        case 'SESSION_RESET': {
          alert('Session has ended and database was reset. Redirecting to dashboard.');
          navigate('/dashboard');
          break;
        }

        case 'QUESTION_CREATED':
        case 'QUESTION_UPDATED':
        case 'QUESTION_DELETED':
        case 'QUESTION_REVEALED':
        case 'HINT_CREATED':
        case 'HINT_REVEALED':
        case 'TESTCASE_REVEALED':
          fetchQuestions();
          break;

        case 'SESSION_STATUS_CHANGED': {
          const newStatus = msg.payload?.status;
          if (newStatus) {
            setSession((prev) => (prev ? { ...prev, status: newStatus } : null));
            if (newStatus === 'COMPLETED') {
              setShowEndedSummary(true);
            }
          }
          break;
        }

        case 'AUDIT_EVENT':
          if (msg.payload) {
            setAuditLogs((prev) => [msg.payload, ...prev.slice(0, 49)]);
          }
          break;

        default:
          break;
      }
    },
    [fetchSessionDetails, fetchFiles, fetchQuestions, fetchLogs, rightTab, navigate]
  );

  const { isConnected, sendMessage } = useSessionSocket({
    sessionId,
    onMessage: handleWsMessage
  });

  const applyLayoutMode = (mode: 'standard' | 'focus' | 'split' | 'proctor') => {
    setLayoutMode(mode);
    if (mode === 'standard') {
      setIsLeftSidebarOpen(true);
      setIsRightSidebarOpen(true);
    } else if (mode === 'focus') {
      setIsLeftSidebarOpen(false);
      setIsRightSidebarOpen(false);
    } else if (mode === 'split') {
      setIsLeftSidebarOpen(true);
      setIsRightSidebarOpen(false);
    } else if (mode === 'proctor') {
      setIsLeftSidebarOpen(false);
      setIsRightSidebarOpen(true);
      setRightTab('proctor');
    }
  };

  const handleOpenWarningModal = (targetId: string, targetName: string) => {
    setWarningTargetUserId(targetId);
    setWarningTargetUserName(targetName);
    setWarningText(`Warning: Suspicious activity observed for candidate ${targetName}. Please adhere to guidelines.`);
    setShowWarningModal(true);
  };

  const handleSendWarning = async () => {
    if (!sessionId || !warningTargetUserId) return;
    try {
      setWarningLoading(true);
      await sessionService.issueWarning(sessionId, warningTargetUserId, warningText);
      sendMessage('SEND_WARNING', {
        targetUserId: warningTargetUserId,
        message: warningText
      });
      setBannerNotice(`Warning sent to ${warningTargetUserName || 'candidate'}.`);
      setTimeout(() => setBannerNotice(null), 3000);
      setShowWarningModal(false);
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to send warning.');
    } finally {
      setWarningLoading(false);
    }
  };

  const handleOpenBlockModal = (targetId: string, targetName: string) => {
    setBlockTargetUserId(targetId);
    setBlockTargetUserName(targetName);
    setBlockReason(`Suspicious activity / rapid pasting detected. Access suspended.`);
    setShowBlockModal(true);
  };

  const handleBlockCandidate = async () => {
    if (!sessionId || !blockTargetUserId) return;
    try {
      setBlockLoading(true);
      await sessionService.blockUser(sessionId, blockTargetUserId, blockReason);
      sendMessage('BLOCK_USER', {
        targetUserId: blockTargetUserId,
        reason: blockReason
      });
      setBannerNotice(`Candidate ${blockTargetUserName} has been blocked.`);
      setTimeout(() => setBannerNotice(null), 3000);
      setShowBlockModal(false);
      fetchSessionDetails();
      fetchFiles();
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to block candidate.');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblockCandidate = async (targetId: string) => {
    if (!sessionId) return;
    try {
      await sessionService.unblockUser(sessionId, targetId);
      setBannerNotice('Candidate unblocked. Collaborative access restored.');
      setTimeout(() => setBannerNotice(null), 3000);
      fetchSessionDetails();
      fetchFiles();
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to unblock candidate.');
    }
  };

  const handleLeaveSession = async () => {
    if (!sessionId) return;
    try {
      setLeaving(true);
      await sessionService.leave(sessionId, true);
      alert('You have left the session. Demo accounts have been removed and database session records reset.');
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Failed to leave session:', err);
      navigate('/dashboard');
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        fetchSessionDetails(),
        fetchFiles(),
        fetchQuestions(),
        fetchLogs()
      ]);
      setLoading(false);
    };
    init();

    sessionService
      .getUsersList()
      .then((u) => {
        setAvailableUsers(u.filter((x) => x.id !== user?.id));
      })
      .catch(() => {});

    return () => {
      if (editTimerRef.current) clearTimeout(editTimerRef.current);
      if (httpSaveTimerRef.current) clearTimeout(httpSaveTimerRef.current);
    };
  }, [sessionId, fetchSessionDetails, fetchFiles, fetchQuestions, fetchLogs, user?.id]);

  // Code Editing with zero lag, guaranteed persistence, and Line Timestamp History & Anti-Cheat
  const handleEditorChange = (value?: string) => {
    if (!activeFile || value === undefined) return;

    // 1. Update React state immediately
    setActiveFile((prev) => (prev ? { ...prev, content: value } : null));
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFile.id ? { ...f, content: value } : f))
    );

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

    // Detect millisecond burst or large paste operation (<60ms or large diff)
    const isMillisecondBurst = (diff > 25 && elapsedMs < 60) || (lineDiff > 2 && elapsedMs < 100);

    if (isMillisecondBurst) {
      const alertMsg = `⚠️ Rapid code insertion detected (${elapsedMs}ms, +${diff} chars). Copy-paste logged.`;
      setSuspiciousAlert({
        message: alertMsg,
        actorName: user?.name || 'Interviewer',
        charCount: diff,
        lineNumber: currentLines.length,
        timestamp: Date.now()
      });
      setBannerNotice(alertMsg);
      setTimeout(() => {
        setSuspiciousAlert(null);
        setBannerNotice(null);
      }, 5000);

      sendMessage('SUSPICIOUS_ACTIVITY', {
        fileId: activeFile.id,
        eventType: 'BURST_PASTE_DETECTED',
        details: {
          elapsedMs,
          insertedChars: diff,
          linesAdded: lineDiff,
          alert: `Interviewer/User inserted ${diff} chars in ${elapsedMs}ms.`
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
        author: isChanged ? (user?.name || 'Interviewer') : existing?.author || 'Session Code',
        isSuspicious: isChanged && isMillisecondBurst ? true : existing?.isSuspicious || false,
        burstSpeedMs: isChanged && isMillisecondBurst ? elapsedMs : existing?.burstSpeedMs
      };
    });
    setLineHistory(updatedRecords);

    // 2. Broadcast via WebSocket for instant peer sync
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
    }, 30);

    // 3. Debounce HTTP backup save to guarantee DB persistence
    if (httpSaveTimerRef.current) {
      clearTimeout(httpSaveTimerRef.current);
    }
    httpSaveTimerRef.current = setTimeout(async () => {
      try {
        await fileService.updateFile(activeFile.id, { content: value });
        setLastSavedTime(new Date().toLocaleTimeString());
      } catch (e) {
        console.warn('Background save note:', e);
      }
    }, 1200);
  };

  const handleManualSave = async () => {
    if (!activeFile) return;
    try {
      setSaving(true);
      await fileService.updateFile(activeFile.id, { content: activeFile.content });
      setLastSavedTime(new Date().toLocaleTimeString());
      setBannerNotice('File saved successfully!');
      setTimeout(() => setBannerNotice(null), 2500);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  // Lock Permission Engine Actions
  const handleToggleMasterLock = async () => {
    if (!sessionId) return;
    try {
      setLockLoading(true);
      const targetState = !isMasterLocked;
      const res = await sessionService.toggleMasterLock(sessionId, targetState);
      setFiles(res.files);
      setBannerNotice(res.message);
      setTimeout(() => setBannerNotice(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to toggle Lock Permission Engine');
    } finally {
      setLockLoading(false);
    }
  };

  const handleToggleScreenLock = async () => {
    if (!sessionId) return;
    try {
      const nextLocked = !isScreenLocked;
      setIsScreenLocked(nextLocked);
      if (nextLocked) {
        await sessionService.lockScreen(sessionId, 'Screen locked by interviewer.');
      } else {
        await sessionService.unlockScreen(sessionId);
      }
      sendMessage('LOCK_SCREEN', {
        isScreenLocked: nextLocked,
        reason: nextLocked ? 'Screen locked by interviewer.' : ''
      });
      setBannerNotice(nextLocked ? 'Candidate screen locked.' : 'Candidate screen unlocked.');
      setTimeout(() => setBannerNotice(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to toggle screen lock');
    }
  };

  const handleToggleLock = async (file: IFile) => {
    try {
      const isCurrentlyLocked = file.permission === 'LOCKED';
      const targetPerm = isCurrentlyLocked ? 'VISIBLE_EDITABLE' : 'LOCKED';

      // Optimistic update
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, permission: targetPerm } : f))
      );
      if (activeFile?.id === file.id) {
        setActiveFile((prev) => (prev ? { ...prev, permission: targetPerm } : null));
      }

      if (isCurrentlyLocked) {
        await fileService.unlock(file.id);
      } else {
        await fileService.lock(file.id);
      }
      await fetchFiles();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update lock state');
      await fetchFiles();
    }
  };

  const handleToggleVisibility = async (file: IFile) => {
    try {
      const isCurrentlyHidden = file.permission === 'HIDDEN';
      const targetPerm = isCurrentlyHidden ? 'VISIBLE_READONLY' : 'HIDDEN';

      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, permission: targetPerm } : f))
      );

      if (isCurrentlyHidden) {
        await fileService.show(file.id);
      } else {
        await fileService.hide(file.id);
      }
      await fetchFiles();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update visibility');
      await fetchFiles();
    }
  };

  const handleToggleReadonly = async (file: IFile) => {
    try {
      const isCurrentlyReadonly = file.permission === 'VISIBLE_READONLY';
      const targetPerm = isCurrentlyReadonly ? 'VISIBLE_EDITABLE' : 'VISIBLE_READONLY';

      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, permission: targetPerm } : f))
      );

      if (isCurrentlyReadonly) {
        await fileService.editable(file.id);
      } else {
        await fileService.readonly(file.id);
      }
      await fetchFiles();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update editable state');
      await fetchFiles();
    }
  };

  const handleSetFilePermission = async (
    fileId: string,
    permission: 'VISIBLE_EDITABLE' | 'VISIBLE_READONLY' | 'LOCKED'
  ) => {
    try {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, permission } : f))
      );
      if (activeFileRef.current?.id === fileId) {
        setActiveFile((prev) => (prev ? { ...prev, permission } : null));
      }

      if (permission === 'VISIBLE_EDITABLE') {
        await fileService.editable(fileId);
      } else if (permission === 'VISIBLE_READONLY') {
        await fileService.readonly(fileId);
      } else if (permission === 'LOCKED') {
        await fileService.lock(fileId);
      }

      setBannerNotice(`File permission updated to [${permission}]. Synchronized across participants.`);
      setTimeout(() => setBannerNotice(null), 3000);
      await fetchFiles();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update file permission');
      await fetchFiles();
    }
  };

  // Question Management & Change
  const handleOpenCreateQuestion = () => {
    setEditingQuestion(null);
    setQuestionTitle('');
    setQuestionDesc('');
    setQuestionDifficulty('MEDIUM');
    setShowQuestionModal(true);
  };

  const handleOpenEditQuestion = (q: IQuestion) => {
    setEditingQuestion(q);
    setQuestionTitle(q.title);
    setQuestionDesc(q.description);
    setQuestionDifficulty((q.difficulty as any) || 'MEDIUM');
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !questionTitle.trim()) return;

    try {
      setQuestionLoading(true);
      if (editingQuestion) {
        await resourceService.updateQuestion(editingQuestion.id, {
          title: questionTitle.trim(),
          description: questionDesc.trim(),
          difficulty: questionDifficulty
        });
        setBannerNotice('Question statement updated and synced to all participants.');
      } else {
        await resourceService.createQuestion(sessionId, {
          title: questionTitle.trim(),
          description: questionDesc.trim(),
          difficulty: questionDifficulty
        });
        setBannerNotice('New question created in session.');
      }
      await fetchQuestions();
      setShowQuestionModal(false);
      setTimeout(() => setBannerNotice(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to save question');
    } finally {
      setQuestionLoading(false);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Are you sure you want to delete this question along with all its hints?')) return;
    try {
      await resourceService.deleteQuestion(qId);
      await fetchQuestions();
      setBannerNotice('Question removed.');
      setTimeout(() => setBannerNotice(null), 2500);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to delete question');
    }
  };

  const handleRevealQuestion = async (qId: string) => {
    try {
      await resourceService.revealQuestion(qId);
      await fetchQuestions();
      setBannerNotice('Question revealed to candidate.');
      setTimeout(() => setBannerNotice(null), 2500);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to reveal question');
    }
  };

  // Hints Management & Progressive Reveal
  const handleOpenAddHint = (qId: string) => {
    setHintQuestionId(qId);
    setHintTitle('');
    setHintContent('');
    setShowHintModal(true);
  };

  const handleSaveHint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hintQuestionId || !hintTitle.trim()) return;

    try {
      setHintLoading(true);
      await resourceService.createHint(hintQuestionId, {
        title: hintTitle.trim(),
        content: hintContent.trim()
      });
      await fetchQuestions();
      setShowHintModal(false);
      setBannerNotice('New hint created. You can reveal it whenever candidate is ready.');
      setTimeout(() => setBannerNotice(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to create hint');
    } finally {
      setHintLoading(false);
    }
  };

  const handleRevealHint = async (hintId: string) => {
    try {
      await resourceService.revealHint(hintId);
      await fetchQuestions();
      setBannerNotice('Hint revealed to candidate.');
      setTimeout(() => setBannerNotice(null), 2500);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to reveal hint');
    }
  };

  // Session Lifecycle & End Session
  const handleSessionAction = async (action: 'start' | 'pause') => {
    if (!sessionId) return;
    try {
      if (action === 'start') await sessionService.start(sessionId);
      if (action === 'pause') await sessionService.pause(sessionId);
      await fetchSessionDetails();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || `Failed to ${action} session`);
    }
  };

  const handleConfirmEndSession = async () => {
    if (!sessionId) return;
    try {
      setEndingSession(true);
      // Auto-save past 10-minute screen recording for replay
      await sessionRecordingService.stopRecordingAndSave(sessionId, user?.name || 'Interviewer');
      await sessionService.end(sessionId);
      await fetchSessionDetails();
      setShowEndSessionConfirm(false);
      setShowEndedSummary(true);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to end session');
    } finally {
      setEndingSession(false);
    }
  };

  // File Creation
  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !newFileName.trim()) return;

    try {
      let cleanName = newFileName.trim();
      if (!cleanName.includes('.')) {
        cleanName += '.cpp';
      }
      const created = await fileService.createFile(sessionId, {
        name: cleanName,
        language: cleanName.endsWith('.cpp') ? 'cpp' : newFileLang,
        content: `// ${cleanName}\n#include <iostream>\n\n`,
        permission: newFilePerm
      });
      setShowAddFileModal(false);
      setNewFileName('');
      await fetchFiles();
      setActiveFile(created);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to create file');
    }
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      let cleanName = newName.trim();
      if (!cleanName.includes('.')) {
        cleanName += '.cpp';
      }
      await fileService.renameFile(fileId, cleanName);
      setRenamingFileId(null);
      setRenamingActiveFile(false);
      await fetchFiles();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to rename file.');
    }
  };

  // Run Code
  const handleRunCode = async () => {
    if (!sessionId || !activeFile) return;
    setExecuting(true);
    setShowBottomConsole(true);
    setExecResult(null);

    try {
      const result = await sessionService.executeCode(sessionId, {
        fileId: activeFile.id,
        code: activeFile.content,
        language: activeFile.language,
        stdinInput: stdinInput
      });
      setExecResult(result);
    } catch (err: any) {
      setExecResult({
        status: 'RUNTIME_ERROR',
        stderr: err.response?.data?.error?.message || 'Execution failed'
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

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !inviteEmail.trim()) return;

    try {
      setInviteLoading(true);
      await sessionService.addParticipant(sessionId, {
        email: inviteEmail.trim(),
        role: inviteRole
      });
      setInviteSuccess('Collaborator added successfully!');
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess(null);
      }, 1500);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to add user to session.');
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-semibold">Loading session workspace...</p>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-64px)] flex flex-col ${themeConfig.bgPage} text-slate-800 overflow-hidden font-sans transition-colors duration-200`}>
      {/* Completed Session Notification Banner */}
      {session?.status === 'COMPLETED' && (
        <div className="bg-slate-900 text-slate-100 px-4 py-2 text-xs flex items-center justify-between z-30 shadow-md">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-amber-300">Session Completed & Archived:</span>
            <span className="text-slate-300">This session has been finalized. Code and activity timeline are preserved.</span>
          </div>
          <Link
            to={`/sessions/${sessionId}/replay`}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <History className="w-3.5 h-3.5" />
            <span>Open Session Replay</span>
          </Link>
        </div>
      )}

      {/* Floating Status Notification */}
      {bannerNotice && (
        <div className="fixed top-18 right-6 z-40 bg-slate-900/90 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 animate-fadeIn border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{bannerNotice}</span>
        </div>
      )}

      {/* RED ALERT NOTIFICATION: Live Copy-Paste & Suspicious Activity Detection */}
      {suspiciousAlert && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white rounded-2xl shadow-2xl border-2 border-red-300 p-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-white/20 text-white shadow-inner animate-pulse shrink-0">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/40 border border-white/20 text-white">
                    🚨 Suspicious Activity Detected
                  </span>
                  <span className="text-xs font-mono text-red-100">
                    {new Date(suspiciousAlert.timestamp || Date.now()).toLocaleTimeString()}
                  </span>
                </div>
                <h4 className="text-sm font-bold mt-1.5 text-white leading-snug">
                  {suspiciousAlert.message}
                </h4>
                {suspiciousAlert.preview && (
                  <div className="mt-2 p-2 bg-black/40 rounded-lg border border-white/10 font-mono text-[11px] text-red-100 break-all max-h-16 overflow-y-auto custom-scrollbar">
                    <span className="text-white/60 text-[10px] uppercase font-bold block mb-0.5">Pasted Snippet Preview:</span>
                    {suspiciousAlert.preview}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setSuspiciousAlert(null)}
              className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
              title="Dismiss Alert"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/20 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowTimestampDrawer(true);
                  setSuspiciousAlert(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-white text-red-700 hover:bg-red-50 font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Inspect Line Stamps</span>
              </button>
              <button
                onClick={() => {
                  handleOpenWarningModal(
                    session?.candidateId ? ((session.candidateId as any)?._id || session.candidateId) : '',
                    session?.candidateId ? ((session.candidateId as any)?.name || 'Candidate') : 'Candidate'
                  );
                  setSuspiciousAlert(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-950 text-white border border-white/30 transition flex items-center gap-1.5 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                <span>Issue Warning</span>
              </button>
            </div>

            <button
              onClick={() => setSuspiciousAlert(null)}
              className="text-white/80 hover:text-white underline cursor-pointer text-[11px]"
            >
              Dismiss Alert
            </button>
          </div>
        </div>
      )}

      {/* Top Session Control Ribbon */}
      <div className={`h-14 border-b ${themeConfig.border} ${themeConfig.bgCard} px-4 flex items-center justify-between shadow-xs z-20 transition-colors duration-200`}>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <h1 className="text-sm font-bold text-slate-900 tracking-tight truncate max-w-xs md:max-w-md">
              {session?.title}
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
              {session?.sessionCode}
            </span>
            <button
              onClick={handleCopyCode}
              title="Copy session code to share"
              className="p-1 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Master Lock Engine Quick Toggle Pill */}
          <button
            onClick={handleToggleMasterLock}
            disabled={lockLoading}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              isMasterLocked
                ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-sm animate-pulse'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            }`}
            title="Click to engage or disengage Master Lock Engine"
          >
            {isMasterLocked ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>Lock Engine: ENGAGED (Frozen)</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Lock Engine: Live</span>
              </>
            )}
          </button>

          {/* Live Interview Stopwatch & Phased Milestone Tracker */}
          <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-800">
              <Timer className="w-3.5 h-3.5 text-indigo-600" />
              <span>{formatStopwatch(stopwatchSeconds)}</span>
              <button
                onClick={() => setStopwatchRunning(!stopwatchRunning)}
                className="ml-1 p-0.5 hover:text-indigo-600 cursor-pointer text-slate-500"
                title={stopwatchRunning ? 'Pause Stopwatch' : 'Start Stopwatch'}
              >
                {stopwatchRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
              </button>
              <button
                onClick={() => {
                  setStopwatchRunning(false);
                  setStopwatchSeconds(0);
                }}
                className="p-0.5 hover:text-rose-600 cursor-pointer text-slate-400"
                title="Reset Stopwatch"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            <select
              value={interviewPhase}
              onChange={(e) => setInterviewPhase(Number(e.target.value))}
              className="text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 cursor-pointer focus:outline-none"
              title="Current Interview Milestone Phase"
            >
              <option value={1}>🎯 Phase 1: Clarification (0-10m)</option>
              <option value={2}>💡 Phase 2: Algorithm (10-25m)</option>
              <option value={3}>💻 Phase 3: Coding (25-45m)</option>
              <option value={4}>🧪 Phase 4: Big-O & Testing (45-60m)</option>
            </select>
          </div>

          {/* Live Candidate Status Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                candidateActivity === 'typing'
                  ? 'bg-amber-500 animate-ping'
                  : candidateActivity === 'running'
                  ? 'bg-purple-500 animate-pulse'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="text-[11px]">
              {candidateActivity === 'typing'
                ? 'Candidate Typing...'
                : candidateActivity === 'running'
                ? 'Executing Tests...'
                : 'Candidate Live'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dynamic Layout Preset Selector */}
          <div className="hidden lg:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => applyLayoutMode('standard')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                layoutMode === 'standard' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Standard 3-Column Layout"
            >
              Standard
            </button>
            <button
              onClick={() => applyLayoutMode('focus')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                layoutMode === 'focus' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Focus Code: Fullscreen Editor"
            >
              Focus
            </button>
            <button
              onClick={() => applyLayoutMode('split')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                layoutMode === 'split' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Split Code & Files"
            >
              Split
            </button>
            <button
              onClick={() => applyLayoutMode('proctor')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                layoutMode === 'proctor' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Proctoring & Audit Focus"
            >
              Proctor
            </button>
          </div>

          {/* Editor Zoom Controls */}
          <div className="hidden xl:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setEditorFontSize((s) => Math.max(10, s - 1))}
              className="p-1 hover:bg-white rounded text-slate-600"
              title="Decrease Editor Font Size"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1 font-semibold text-slate-700">{editorFontSize}px</span>
            <button
              onClick={() => setEditorFontSize((s) => Math.min(22, s + 1))}
              className="p-1 hover:bg-white rounded text-slate-600"
              title="Increase Editor Font Size"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Line Timestamp Inspector Button with Suspicious Counter */}
          {(() => {
            const suspiciousCount = lineHistory.filter((l) => l.isSuspicious).length;
            return (
              <button
                onClick={() => setShowTimestampDrawer(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer shadow-2xs ${
                  suspiciousCount > 0
                    ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-300 ring-2 ring-red-400/30'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                }`}
                title="Inspect Line-by-Line Millisecond Timestamp History & Burst Pastes"
              >
                <Clock className={`w-3.5 h-3.5 ${suspiciousCount > 0 ? 'text-red-600 animate-pulse' : 'text-indigo-600'}`} />
                <span className="hidden md:inline">Line Timestamps</span>
                {suspiciousCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-mono animate-bounce">
                    {suspiciousCount} Flagged
                  </span>
                )}
              </button>
            );
          })()}

          {/* Session File Storage Archive Button */}
          <button
            onClick={handleOpenStorageModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition cursor-pointer shadow-2xs"
            title="Open Session File Storage Archive"
          >
            <FolderArchive className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Files Storage ({files.length})</span>
          </button>

          {/* Assessment Scorecard & Rubric Drawer Button */}
          <button
            onClick={() => setShowRubricModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 transition cursor-pointer shadow-2xs"
            title="Open Candidate Evaluation Rubric & Private Scratchpad"
          >
            <Award className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Scorecard & Rubric</span>
          </button>

          {/* Educational Theme Selector */}
          <ThemeSelector />

          {/* Friends & Study Buddies Button */}
          <button
            onClick={() => setShowFriendsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition border border-indigo-200 cursor-pointer"
            title="Open Study Buddies & Invite Friends"
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Friends</span>
          </button>

          {/* Add Collaborator */}
          <button
            onClick={() => {
              setInviteEmail('');
              setInviteSuccess(null);
              setShowInviteModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Add Collaborator</span>
          </button>

          {/* Lifecycle actions */}
          {session?.status !== 'ACTIVE' && session?.status !== 'COMPLETED' && (
            <button
              onClick={() => handleSessionAction('start')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Start</span>
            </button>
          )}

          {session?.status === 'ACTIVE' && (
            <button
              onClick={() => handleSessionAction('pause')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
            >
              <Pause className="w-3 h-3" />
              <span>Pause</span>
            </button>
          )}

          {/* Dedicated End Session Button (Only for session creator) */}
          {isCreator && (
            session?.status !== 'COMPLETED' ? (
              <button
                onClick={() => setShowEndSessionConfirm(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition shadow-sm shadow-rose-600/20 cursor-pointer"
                title="Finalize and End Session"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>End Session</span>
              </button>
            ) : (
              <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-semibold border border-slate-200">
                Ended
              </span>
            )
          )}

          {/* Leave Session with Database Reset Button */}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition cursor-pointer"
            title="Leave Session & Reset Database"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden sm:inline">Leave Session</span>
          </button>

          <Link
            to={`/sessions/${sessionId}/replay`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition"
          >
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden md:inline">Replay</span>
          </Link>
        </div>
      </div>

      {/* Main 3-Column Working Interface */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Lock Permission Engine, File Matrix & Progressive Reveal Controls */}
        {isLeftSidebarOpen ? (
          <div className={`w-80 xl:w-88 border-r ${themeConfig.border} ${themeConfig.bgCard} flex flex-col overflow-y-auto shrink-0 shadow-xs transition-all duration-200`}>
            {/* Header with collapse button */}
            <div className="h-10 px-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                Control Center
              </span>
              <button
                onClick={() => setIsLeftSidebarOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition cursor-pointer"
                title="Collapse left panel to expand editor"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Left Column Tabs: Files | Storage | Tasks */}
            <div className="flex items-center border-b border-slate-200 bg-slate-100/70 p-1 gap-1 shrink-0">
              <button
                onClick={() => setLeftTab('files')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  leftTab === 'files'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Files</span>
              </button>

              <button
                onClick={() => setLeftTab('storage')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  leftTab === 'storage'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <FolderArchive className="w-3.5 h-3.5 text-indigo-600" />
                <span>Storage</span>
              </button>

              <button
                onClick={() => setLeftTab('questions')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  leftTab === 'questions'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Tasks</span>
              </button>
            </div>

            {/* Storage Tab View */}
            {leftTab === 'storage' && (
              <div className="flex-1 overflow-y-auto">
                <SessionFileStorage
                  sessionId={sessionId!}
                  files={files}
                  activeFileId={activeFile?.id}
                  isInterviewer={true}
                  onSelectFile={(f) => setActiveFile(f)}
                  onRefreshFiles={fetchFiles}
                  onFileCreated={fetchFiles}
                />
              </div>
            )}

            {/* Files Tab View */}
            {leftTab === 'files' && (
              <>
                {/* 1. Master Lock Permission Engine Control Card */}
                <div className="p-4 border-b border-slate-200 bg-gradient-to-b from-slate-50/70 to-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  Lock Permission Engine
                </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isMasterLocked
                    ? 'bg-rose-100 text-rose-700 border border-rose-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {isMasterLocked ? 'LOCKED' : 'ARMED'}
              </span>
            </div>

            <div
              className={`p-3 rounded-xl border transition-all ${
                isMasterLocked
                  ? 'bg-rose-50/70 border-rose-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <p className="text-[11px] text-slate-600 mb-2.5 leading-relaxed">
                {isMasterLocked
                  ? 'Candidate inputs are FROZEN across all files. Interviewer maintains full editing rights.'
                  : 'Candidate has write access on editable files. Engage lock to immediately freeze candidate typing.'}
              </p>
              <button
                onClick={handleToggleMasterLock}
                disabled={lockLoading}
                className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm cursor-pointer ${
                  isMasterLocked
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {isMasterLocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unfreeze Editor & Unlock</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Freeze All Candidate Inputs</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. Dynamic File Matrix Panel */}
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                Files ({files.length})
              </span>
              <button
                onClick={() => setShowAddFileModal(true)}
                className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="Add New File"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {files.map((file) => {
                const isSelected = activeFile?.id === file.id;
                const isLocked = file.permission === 'LOCKED';
                const isHidden = file.permission === 'HIDDEN';
                const isReadonly = file.permission === 'VISIBLE_READONLY';

                return (
                  <div
                    key={file.id}
                    onClick={() => setActiveFile(file)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-300 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {renamingFileId === file.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleRenameFile(file.id, renameValue);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 flex-1 mr-2"
                        >
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            autoFocus
                            className="px-1.5 py-0.5 text-xs font-mono bg-white border border-indigo-500 rounded text-slate-900 focus:outline-none w-full"
                            placeholder="filename.cpp"
                          />
                          <button
                            type="submit"
                            className="px-2 py-0.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingFileId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-slate-800 truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingFileId(file.id);
                              setRenameValue(file.name);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
                            title="Rename File"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          isLocked
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : isHidden
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : isReadonly
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {file.permission}
                      </span>
                    </div>

                    {/* Explicit File Permission Selector Buttons */}
                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-200/80">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetFilePermission(file.id, 'VISIBLE_EDITABLE');
                          }}
                          className={`flex-1 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer border ${
                            file.permission === 'VISIBLE_EDITABLE'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                          }`}
                          title="Candidate Permission: Editable"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetFilePermission(file.id, 'VISIBLE_READONLY');
                          }}
                          className={`flex-1 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer border ${
                            file.permission === 'VISIBLE_READONLY'
                              ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                          }`}
                          title="Candidate Permission: Read-Only"
                        >
                          <Eye className="w-2.5 h-2.5" />
                          <span>Read</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetFilePermission(file.id, 'LOCKED');
                          }}
                          className={`flex-1 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer border ${
                            file.permission === 'LOCKED'
                              ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                          }`}
                          title="Candidate Permission: Locked"
                        >
                          <Lock className="w-2.5 h-2.5" />
                          <span>Lock</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleVisibility(file);
                          }}
                          className={`w-full py-0.5 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition cursor-pointer border ${
                            isHidden
                              ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                          }`}
                          title={isHidden ? 'Reveal file to candidate' : 'Hide file from candidate'}
                        >
                          {isHidden ? <Eye className="w-2.5 h-2.5 text-purple-600" /> : <EyeOff className="w-2.5 h-2.5 text-slate-500" />}
                          <span>{isHidden ? 'Reveal to Candidate' : 'Hide from Candidate'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 3. Assessment Questions & Progressive Reveal Engine */}
      {leftTab === 'questions' && (
        <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Assessment Questions ({questions.length})
              </span>
              <button
                onClick={handleOpenCreateQuestion}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition cursor-pointer"
                title="Add New Question"
              >
                <Plus className="w-3 h-3" />
                <span>New Question</span>
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((q) => {
                const revealedHintsCount = (q.hints || []).filter((h) => h.status === 'REVEALED').length;
                const totalHintsCount = (q.hints || []).length;

                return (
                  <div key={q.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs shadow-xs">
                    {/* Question Header & Actions */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{q.title}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              q.difficulty === 'EASY'
                                ? 'bg-emerald-100 text-emerald-700'
                                : q.difficulty === 'HARD'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {q.difficulty || 'MEDIUM'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditQuestion(q)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition cursor-pointer"
                          title="Change / Edit Question"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded transition cursor-pointer"
                          title="Delete Question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-slate-600 text-[11px] mb-3 leading-relaxed whitespace-pre-wrap">{q.description}</p>

                    {/* Status & Reveal Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 mb-3">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Visibility:</span>
                      {q.status === 'HIDDEN' ? (
                        <button
                          onClick={() => handleRevealQuestion(q.id)}
                          className="px-2.5 py-0.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[10px] cursor-pointer shadow-xs"
                        >
                          Reveal Question
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> Revealed to Candidate
                        </span>
                      )}
                    </div>

                    {/* Progressive Reveal Hints Section */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                          Hints ({revealedHintsCount}/{totalHintsCount} Revealed)
                        </span>
                        <button
                          onClick={() => handleOpenAddHint(q.id)}
                          className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-[10px] border border-amber-200 transition cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Hint</span>
                        </button>
                      </div>

                      {q.hints && q.hints.length > 0 ? (
                        <div className="space-y-2">
                          {q.hints.map((h, idx) => (
                            <div
                              key={h.id}
                              className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-slate-800 text-[11px] font-bold">
                                  Hint #{idx + 1}: {h.title}
                                </span>
                                {h.status === 'HIDDEN' ? (
                                  <button
                                    onClick={() => handleRevealHint(h.id)}
                                    className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[10px] cursor-pointer shadow-xs"
                                  >
                                    Reveal Hint
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Revealed
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 leading-snug">{h.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">No hints added yet. Click &apos;Add Hint&apos; to guide candidates.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      ) : (
          <div className={`w-12 border-r ${themeConfig.border} ${themeConfig.bgCard} flex flex-col items-center py-3 gap-3 shrink-0 shadow-xs transition-all duration-200`}>
            <button
              onClick={() => setIsLeftSidebarOpen(true)}
              className="p-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer shadow-2xs"
              title="Expand left panel (Files & Questions)"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <div className="w-6 h-[1px] bg-slate-200" />
            <button
              onClick={() => setIsLeftSidebarOpen(true)}
              className="relative p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
              title={`Files (${files.length})`}
            >
              <FileCode className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 text-[9px] font-bold w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                {files.length}
              </span>
            </button>
            <button
              onClick={() => setIsLeftSidebarOpen(true)}
              className={`p-2 rounded-lg transition cursor-pointer ${
                isMasterLocked ? 'text-rose-600 bg-rose-50' : 'text-slate-400 hover:text-emerald-600'
              }`}
              title={isMasterLocked ? 'Lock Engine Active' : 'Lock Engine Live'}
            >
              <Shield className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsLeftSidebarOpen(true)}
              className="relative p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
              title={`Questions (${questions.length})`}
            >
              <HelpCircle className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 text-[9px] font-bold w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                {questions.length}
              </span>
            </button>
          </div>
        )}

        {/* Center Column: Live Collaborative Monaco Editor */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
          {/* Row 1: VS Code-Style Horizontal File Tab Bar */}
          <div className="h-10 border-b border-slate-200 bg-slate-100/80 px-2 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 min-w-0">
              {!isLeftSidebarOpen && (
                <button
                  onClick={() => setIsLeftSidebarOpen(true)}
                  className="mr-1 p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-md transition cursor-pointer shrink-0"
                  title="Expand left panel"
                >
                  <PanelLeftOpen className="w-3.5 h-3.5" />
                </button>
              )}

              {/* File Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {files.map((file) => {
                  const isSelected = activeFile?.id === file.id;
                  const isLocked = file.permission === 'LOCKED';
                  const isReadonly = file.permission === 'VISIBLE_READONLY';
                  return (
                    <button
                      key={file.id}
                      onClick={() => setActiveFile(file)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer shrink-0 border ${
                        isSelected
                          ? 'bg-white text-indigo-700 font-bold border-indigo-200 shadow-xs ring-1 ring-indigo-500/10'
                          : 'bg-slate-50/70 text-slate-600 hover:bg-white/80 border-slate-200/60'
                      }`}
                      title={`${file.name} (${file.language})`}
                    >
                      <FileCode className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="truncate max-w-[120px]">{file.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-sans font-bold uppercase tracking-wider ${
                          isLocked
                            ? 'bg-rose-100 text-rose-700'
                            : isReadonly
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {isLocked ? 'Lock' : isReadonly ? 'Read' : 'Edit'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Add File button on Tab bar */}
              <button
                onClick={() => setShowAddFileModal(true)}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-md transition cursor-pointer shrink-0"
                title="Create New File (+)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-2">
              {/* Quick Storage Button */}
              <button
                onClick={handleOpenStorageModal}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 transition cursor-pointer"
                title="Open Session File Storage Archive"
              >
                <FolderArchive className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Storage</span>
              </button>

              {!isRightSidebarOpen && (
                <button
                  onClick={() => setIsRightSidebarOpen(true)}
                  className="ml-1 p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-md transition cursor-pointer"
                  title="Expand right panel (Media & Audit Feed)"
                >
                  <PanelRightOpen className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Secondary Toolbar with Permission Mode, Complexity & Save/Run Controls */}
          <div className="h-11 border-b border-slate-200 bg-slate-50/90 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {renamingActiveFile && activeFile ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRenameFile(activeFile.id, activeRenameVal);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={activeRenameVal}
                    onChange={(e) => setActiveRenameVal(e.target.value)}
                    autoFocus
                    className="px-2 py-0.5 text-xs font-mono bg-white border border-indigo-500 rounded text-slate-900 focus:outline-none"
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
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-slate-800 font-bold">
                    {activeFile ? activeFile.name : 'No file selected'}
                  </span>
                  {activeFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRenameVal(activeFile.name);
                        setRenamingActiveFile(true);
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                      title="Rename Active File"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {activeFile && (
                    <span className="text-[11px] font-medium text-slate-400">({activeFile.language})</span>
                  )}
                </div>
              )}
              {lastSavedTime && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-500" /> Saved {lastSavedTime}
                </span>
              )}

              {/* Active File Permission Control - 3-Mode Segmented Selector */}
              {activeFile && (
                <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 ml-2">
                  <button
                    onClick={() => handleSetFilePermission(activeFile.id, 'VISIBLE_EDITABLE')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      activeFile.permission === 'VISIBLE_EDITABLE'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Allow candidate to edit code collaboratively in real-time"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleSetFilePermission(activeFile.id, 'VISIBLE_READONLY')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      activeFile.permission === 'VISIBLE_READONLY'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Set file to Read-Only for candidate (observation mode)"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Read Only</span>
                  </button>

                  <button
                    onClick={() => handleSetFilePermission(activeFile.id, 'LOCKED')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      activeFile.permission === 'LOCKED'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Freeze and lock file against candidate edits"
                  >
                    <Lock className="w-3 h-3" />
                    <span>File Lock</span>
                  </button>
                </div>
              )}

              {/* Lock Candidate Screen Feature */}
              <button
                onClick={handleToggleScreenLock}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ml-1.5 ${
                  isScreenLocked
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-xs ring-2 ring-amber-500/30'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
                title={isScreenLocked ? 'Unlock candidate screen' : 'Lock candidate screen and freeze interaction'}
              >
                {isScreenLocked ? <Lock className="w-3 h-3 text-white" /> : <Unlock className="w-3 h-3 text-slate-600" />}
                <span>{isScreenLocked ? 'Screen Locked' : 'Lock Screen'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Educational Big-O Complexity Target Selector */}
              <div className="hidden xl:flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs shadow-2xs">
                <BrainCircuit className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Target:</span>
                <select
                  value={targetTimeComplexity}
                  onChange={(e) => setTargetTimeComplexity(e.target.value)}
                  className="font-mono font-bold text-[11px] text-indigo-700 bg-transparent focus:outline-none cursor-pointer"
                  title="Target Problem Time Complexity"
                >
                  <option value="O(1)">Time: O(1)</option>
                  <option value="O(log N)">Time: O(log N)</option>
                  <option value="O(N)">Time: O(N)</option>
                  <option value="O(N log N)">Time: O(N log N)</option>
                  <option value="O(N^2)">Time: O(N²)</option>
                </select>
                <span className="text-slate-300">|</span>
                <select
                  value={targetSpaceComplexity}
                  onChange={(e) => setTargetSpaceComplexity(e.target.value)}
                  className="font-mono font-bold text-[11px] text-sky-700 bg-transparent focus:outline-none cursor-pointer"
                  title="Target Problem Space Complexity"
                >
                  <option value="O(1)">Space: O(1)</option>
                  <option value="O(log N)">Space: O(log N)</option>
                  <option value="O(N)">Space: O(N)</option>
                  <option value="O(N^2)">Space: O(N²)</option>
                </select>
              </div>

              {/* Save Button */}
              <button
                onClick={handleManualSave}
                disabled={saving || !activeFile}
                className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200 transition shadow-2xs cursor-pointer disabled:opacity-50"
                title="Save Code (Ctrl+S)"
              >
                {saving ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                ) : (
                  <Save className="w-3 h-3 text-slate-600" />
                )}
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>

              {/* Run Code Button */}
              <button
                onClick={handleRunCode}
                disabled={executing || !activeFile}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md transition disabled:opacity-50 shadow-xs cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{executing ? 'Executing...' : 'Run Code'}</span>
              </button>
            </div>
          </div>

          {/* Active Mode Notice Strip */}
          {activeFile && (
            <div className="h-6 px-4 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Candidate State:</span>
                {activeFile.permission === 'VISIBLE_EDITABLE' && (
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Collaborative write access active.
                  </span>
                )}
                {activeFile.permission === 'VISIBLE_READONLY' && (
                  <span className="text-amber-700 font-medium flex items-center gap-1">
                    <Eye className="w-3 h-3 text-amber-600" /> Read-Only observation mode active.
                  </span>
                )}
                {activeFile.permission === 'LOCKED' && (
                  <span className="text-rose-700 font-medium flex items-center gap-1">
                    <Lock className="w-3 h-3 text-rose-600" /> File is locked. Candidate edits rejected by engine.
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Interviewer maintains unrestricted write privileges
              </span>
            </div>
          )}

          {/* Monaco Editor Container */}
          <div className="flex-1 relative overflow-hidden bg-white">
            {activeFile ? (
              <Editor
                height="100%"
                theme={themeConfig.monacoTheme}
                language={activeFile.language === 'cpp' ? 'cpp' : activeFile.language === 'python' ? 'python' : 'javascript'}
                value={activeFile.content}
                onChange={handleEditorChange}
                options={{
                  fontSize: editorFontSize,
                  lineNumbers: 'on',
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  readOnly: false, // Interviewer can ALWAYS edit
                  tabSize: 2,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2">
                <FileCode className="w-8 h-8 text-slate-300" />
                <span>Select a file from the matrix to edit or monitor</span>
              </div>
            )}
          </div>

          {/* Console / Output Drawer */}
          {showBottomConsole && (
            <div className="h-64 border-t border-slate-800 bg-slate-950 text-slate-100 flex flex-col font-mono text-xs overflow-hidden shrink-0">
              <div className="h-9 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
                <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                  <Terminal className="w-4 h-4 text-emerald-400" /> C++ Compiler Output & Stdin Console
                </span>
                <div className="flex items-center gap-2">
                  {execResult && (
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-bold ${
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
                    className="text-xs text-slate-400 hover:text-white px-2 py-0.5 bg-slate-800 rounded hover:bg-slate-700 transition cursor-pointer"
                  >
                    Clear Output
                  </button>
                  <button
                    onClick={() => setShowBottomConsole(false)}
                    className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer ml-1"
                    title="Close console"
                  >
                    <X className="w-4 h-4" />
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
                    placeholder="Inputs for cin (e.g. 10 20)..."
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
                      Click &quot;Run Code&quot; to compile and execute current file. Output will appear here.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Real-Time Audit Feed & Security Alerts */}
        {isRightSidebarOpen ? (
          <div className={`w-80 md:w-92 border-l ${themeConfig.border} ${themeConfig.bgCard} flex flex-col overflow-hidden shrink-0 transition-all duration-200`}>
            {/* Right Column Header Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-slate-100/70 p-1 gap-1 shrink-0">
              <button
                onClick={() => setRightTab('proctor')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  rightTab === 'proctor'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Proctor</span>
              </button>

              <button
                onClick={() => setRightTab('media')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  rightTab === 'media'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cam/Mic</span>
              </button>

              <button
                onClick={() => {
                  setRightTab('chat');
                  setUnreadChatCount(0);
                }}
                className={`relative flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  rightTab === 'chat'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                <span>Chat</span>
                {unreadChatCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadChatCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsRightSidebarOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition cursor-pointer"
                title="Collapse right sidebar"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>

            {/* Tab 1: Proctoring, Warnings, Blocking & Live Security Audit */}
            {rightTab === 'proctor' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Candidates List with Warning & Block Controls */}
                <div className="p-3 border-b border-slate-200 bg-slate-50/70 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      Participants ({session?.participants?.length || 0})
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(!session?.participants || session.participants.length === 0) ? (
                      <p className="text-[11px] text-slate-400 italic">No participants registered yet.</p>
                    ) : (
                      session.participants.map((p) => {
                        const isInterviewer = p.role === 'INTERVIEWER' || p.role === 'HOST';
                        const participantName = p.user?.name || (isInterviewer ? 'Host' : 'Candidate');
                        const participantBlocked = p.isBlocked;

                        return (
                          <div
                            key={p.id || p.userId}
                            className={`p-2.5 rounded-xl border text-xs transition ${
                              participantBlocked
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : 'bg-white border-slate-200 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-2 h-2 rounded-full ${p.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                <span className="font-bold text-slate-800 truncate">{participantName}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-600 uppercase">
                                  {p.role}
                                </span>
                                {participantBlocked && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-rose-600 text-white uppercase">
                                    Blocked
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Interviewer Proctoring Actions */}
                            {!isInterviewer && (
                              <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-100">
                                {participantBlocked ? (
                                  <button
                                    onClick={() => handleUnblockCandidate(p.userId)}
                                    className="flex-1 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
                                  >
                                    <UserCheck className="w-3 h-3" />
                                    <span>Unblock Candidate</span>
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleOpenWarningModal(p.userId, participantName)}
                                      className="flex-1 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center justify-center gap-1 transition cursor-pointer"
                                      title="Issue Official Suspicious Activity Warning"
                                    >
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                      <span>Warning</span>
                                    </button>

                                    <button
                                      onClick={() => handleOpenBlockModal(p.userId, participantName)}
                                      className="flex-1 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-200 flex items-center justify-center gap-1 transition cursor-pointer"
                                      title="Block Candidate for Suspicious Activity"
                                    >
                                      <AlertOctagon className="w-3 h-3 text-rose-600" />
                                      <span>Block</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Audit & Security Log */}
                <div className="p-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 shrink-0">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    Live Audit & Security Log
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{auditLogs.length} events</span>
                </div>

                <div className="flex-1 p-3 space-y-2 overflow-y-auto bg-slate-50/40">
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs">Awaiting session activity...</div>
                  ) : (
                    auditLogs.map((log) => {
                      const isSuspicious = log.eventType === 'LARGE_PASTE' || log.eventType === 'BURST_EDIT' || log.eventType === 'BURST_PASTE_DETECTED';
                      const isDenial = log.eventType === 'PERMISSION_DENIED';
                      const isLock = log.eventType === 'FILE_LOCKED' || (log.eventType as string) === 'SESSION_LOCKED';
                      const isWarn = log.eventType === 'USER_WARNING';
                      const isBlock = log.eventType === 'USER_BLOCKED';

                      return (
                        <div
                          key={log.id || `${log.timestamp}-${Math.random()}`}
                          className={`p-2.5 rounded-lg border text-[11px] shadow-2xs ${
                            isSuspicious || isBlock
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : isDenial || isWarn
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : isLock
                              ? 'bg-purple-50 border-purple-200 text-purple-800'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold font-mono text-[10px]">{log.eventType}</span>
                            <span className="font-mono text-[9px] text-slate-400">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          <p className="text-[11px] leading-tight">
                            <span className="font-semibold text-slate-900">{log.actorName || log.actorRole}</span>
                            {log.metadata?.fileName ? ` on ${log.metadata.fileName}` : ''}
                            {log.metadata?.characters ? ` (${log.metadata.characters} chars)` : ''}
                            {log.metadata?.message ? ` - ${log.metadata.message}` : ''}
                            {log.metadata?.reason ? ` - ${log.metadata.reason}` : ''}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Live Media Cam & Mic */}
            {rightTab === 'media' && (
              <div className="flex-1 p-3 overflow-y-auto">
                <LiveMediaSession
                  sessionId={sessionId!}
                  currentUserId={user?.id || ''}
                  currentUserName={user?.name || 'Interviewer'}
                  currentUserRole={user?.role || 'INTERVIEWER'}
                  currentUserAvatarUrl={user?.avatarUrl}
                  sendMessage={sendMessage}
                  lastSocketMessage={lastWsMsg}
                />
              </div>
            )}

            {/* Tab 3: Real-Time In-Session Chat */}
            {rightTab === 'chat' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <SessionChat
                  sessionId={sessionId!}
                  currentUserId={user?.id || ''}
                  currentUserName={user?.name || 'Interviewer'}
                  currentUserRole={user?.role || 'INTERVIEWER'}
                  messages={chatMessages}
                  onSendMessage={(text) => {
                    sendMessage('CHAT_MESSAGE', { message: text });
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className={`w-12 border-l ${themeConfig.border} ${themeConfig.bgCard} flex flex-col items-center py-3 gap-3 shrink-0 shadow-xs transition-all duration-200`}>
            <button
              onClick={() => setIsRightSidebarOpen(true)}
              className="p-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer shadow-2xs"
              title="Expand right panel (Live Media & Audit Log)"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
            <div className="w-6 h-[1px] bg-slate-200" />
            <button
              onClick={() => setIsRightSidebarOpen(true)}
              className="relative p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
              title="Live Media Feed"
            >
              <Radio className="w-4 h-4 animate-pulse" />
            </button>
            <button
              onClick={() => setIsRightSidebarOpen(true)}
              className="relative p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
              title={`Audit Events (${auditLogs.length})`}
            >
              <Activity className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 text-[9px] font-bold w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center">
                {auditLogs.length}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal: End Session */}
      {showEndSessionConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <StopCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">End & Finalize Session?</h2>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Are you sure you want to end this session? Once concluded, code modification is finalized, participants will be notified, and the full timeline will be saved in your session history records.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEndSessionConfirm(false)}
                disabled={endingSession}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
              >
                Continue Session
              </button>
              <button
                type="button"
                onClick={handleConfirmEndSession}
                disabled={endingSession}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {endingSession ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}
                <span>{endingSession ? 'Finalizing...' : 'Yes, End Session'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal: Session Ended */}
      {showEndedSummary && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Session Finalized!</h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              This session and the past 10-minute screen recording have been recorded and saved. You can review the synchronized video replay, webcam feed, and keystroke timeline anytime.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
              <Link
                to={`/sessions/${sessionId}/replay`}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition"
              >
                <History className="w-4 h-4" />
                <span>Watch 10-Min Screen Video & Replay</span>
              </Link>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add File Modal */}
      {showAddFileModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="text-base font-bold text-slate-900 mb-3">Add Code File</h2>
            <form onSubmit={handleAddFile} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">File Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. tests.cpp"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Language</label>
                <select
                  value={newFileLang}
                  onChange={(e) => setNewFileLang(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                >
                  <option value="cpp">C++</option>
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Initial Permission</label>
                <select
                  value={newFilePerm}
                  onChange={(e) => setNewFilePerm(e.target.value as FilePermission)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                >
                  <option value="VISIBLE_EDITABLE">Visible & Editable</option>
                  <option value="VISIBLE_READONLY">Visible & Readonly</option>
                  <option value="LOCKED">Locked</option>
                  <option value="HIDDEN">Hidden (Confidential)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddFileModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
                >
                  Create File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Change Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                {editingQuestion ? 'Change / Edit Question' : 'Add New Question'}
              </h2>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Question Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reverse a Linked List"
                  value={questionTitle}
                  onChange={(e) => setQuestionTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Difficulty
                </label>
                <select
                  value={questionDifficulty}
                  onChange={(e) => setQuestionDifficulty(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Problem Description & Requirements
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Describe constraints, input/output formats, and problem statement..."
                  value={questionDesc}
                  onChange={(e) => setQuestionDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition resize-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={questionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {questionLoading ? 'Saving...' : editingQuestion ? 'Update Question' : 'Create Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Hint Modal */}
      {showHintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Add Hint to Assessment
              </h2>
              <button
                onClick={() => setShowHintModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHint} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hint Title / Summary
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Consider using two pointers"
                  value={hintTitle}
                  onChange={(e) => setHintTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hint Content
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide guidance without giving away the full answer..."
                  value={hintContent}
                  onChange={(e) => setHintContent(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition resize-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowHintModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={hintLoading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {hintLoading ? 'Adding...' : 'Add Hidden Hint'}
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

      {/* Assessment Rubric & Private Evaluation Scorecard Modal */}
      {showRubricModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-amber-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-xs">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Candidate Evaluation & Assessment Rubric</h2>
                  <p className="text-[11px] text-slate-500">Industry standard 5-point competency framework & private notes</p>
                </div>
              </div>
              <button
                onClick={() => setShowRubricModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Scorecard Summary Pill */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-[11px] block">Overall Candidate Score:</span>
                  <span className="text-2xl font-bold font-mono text-slate-900">
                    {Object.values(rubricScores).reduce((a, b) => a + b, 0)}{' '}
                    <span className="text-sm font-normal text-slate-400">/ 25</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                    Hiring Recommendation
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${
                      Object.values(rubricScores).reduce((a, b) => a + b, 0) >= 21
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : Object.values(rubricScores).reduce((a, b) => a + b, 0) >= 16
                        ? 'bg-sky-100 text-sky-800 border border-sky-200'
                        : Object.values(rubricScores).reduce((a, b) => a + b, 0) >= 12
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {Object.values(rubricScores).reduce((a, b) => a + b, 0) >= 21
                      ? '⭐ Strong Hire'
                      : Object.values(rubricScores).reduce((a, b) => a + b, 0) >= 16
                      ? '✅ Hire'
                      : Object.values(rubricScores).reduce((a, b) => a + b, 0) >= 12
                      ? '⚠️ Lean Hire / Borderline'
                      : '❌ No Hire'}
                  </span>
                </div>
              </div>

              {/* 5 Scoring Dimensions */}
              <div className="space-y-3">
                {[
                  {
                    key: 'problemSolving',
                    label: '1. Problem Formulation & Edge Cases',
                    desc: 'Understands problem specifications, asks clarifying questions, uncovers edge cases without prompts.'
                  },
                  {
                    key: 'algorithm',
                    label: '2. Algorithm & Big-O Tradeoffs',
                    desc: 'Designs optimal data structures, understands time/space complexity tradeoffs (O(N) vs O(N²)).'
                  },
                  {
                    key: 'codeQuality',
                    label: '3. Code Cleanliness & Architecture',
                    desc: 'Writes clean, modular code with proper variable naming, separation of concerns, and idioms.'
                  },
                  {
                    key: 'testing',
                    label: '4. Bug Detection & Self-Testing',
                    desc: 'Dry-runs code with inputs, verifies corner cases, identifies and corrects bugs independently.'
                  },
                  {
                    key: 'communication',
                    label: '5. Technical Communication & Articulation',
                    desc: 'Thinks out loud clearly, explains logic effectively, responsive to interviewer hints and feedback.'
                  }
                ].map((item) => (
                  <div key={item.key} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800">{item.label}</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() =>
                              setRubricScores((prev) => ({ ...prev, [item.key]: star }))
                            }
                            className={`w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center transition cursor-pointer ${
                              (rubricScores as any)[item.key] === star
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {star}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Private Scratchpad */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    Private Interviewer Notes (Auto-saved)
                  </span>
                  <span className="text-[10px] text-slate-400">Stored locally &middot; completely private</span>
                </div>
                <textarea
                  value={privateNotes}
                  onChange={(e) => handleSaveNotes(e.target.value)}
                  placeholder="Record observations, candidate approaches, hints provided, and final thoughts..."
                  rows={4}
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white bg-slate-50 leading-relaxed font-sans"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <button
                onClick={handleCopyRubric}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition shadow-2xs cursor-pointer"
              >
                {copiedRubric ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRubric ? 'Copied Assessment!' : 'Copy Assessment Feedback'}</span>
              </button>

              <button
                onClick={() => setShowRubricModal(false)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session File Storage Archive Modal */}
      {showStorageModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FolderArchive className="w-5 h-5 text-indigo-600" />
                  <span>Session File Storage Archive</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  All source files utilized during this session are stored permanently and can be reviewed or downloaded.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadAllStorageFiles}
                  disabled={!storageData?.files?.length}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download All Files ({storageData?.files?.length || 0})</span>
                </button>

                <button
                  onClick={() => setShowStorageModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingStorage ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="text-xs font-semibold">Retrieving session storage snapshot...</p>
                </div>
              ) : !storageData?.files || storageData?.files?.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No files have been created in this session storage yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  {/* File List (4 cols) */}
                  <div className="md:col-span-4 space-y-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Files In Storage ({storageData?.files?.length || 0})
                    </span>
                    {storageData?.files?.map((f: any) => {
                      const isSelected = storageSelectedFile?.id === f.id;
                      return (
                        <div
                          key={f.id}
                          onClick={() => setStorageSelectedFile(f)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileCode className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <div className="min-w-0">
                              <p className="font-mono font-bold text-slate-800 text-xs truncate">{f.name}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {f.lineCount || 0} lines • {((f.sizeBytes || 0) / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase font-semibold">
                            {f.language}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* File Viewer (8 cols) */}
                  <div className="md:col-span-8 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg">
                    <div className="h-10 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-mono text-xs font-bold text-slate-200">
                          {storageSelectedFile?.name || 'File Preview'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          ({storageSelectedFile?.language})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyStorageContent(storageSelectedFile?.content || '')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                        >
                          {storageCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                          <span className="text-[10px]">{storageCopied ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          onClick={() => handleDownloadSingleStorageFile(storageSelectedFile)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span className="text-[10px]">Download</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 overflow-x-auto max-h-[460px] text-xs font-mono text-slate-200 leading-relaxed">
                      <pre className="table">
                        {(storageSelectedFile?.content || '// Empty file').split('\n').map((line: string, idx: number) => (
                          <div key={idx} className="table-row">
                            <span className="table-cell pr-4 text-slate-600 select-none text-right w-10 text-[11px]">
                              {idx + 1}
                            </span>
                            <span className="table-cell whitespace-pre">{line || ' '}</span>
                          </div>
                        ))}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
              <span>Session Code: <strong className="font-mono text-indigo-700">{session?.sessionCode}</strong></span>
              <button
                onClick={() => setShowStorageModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Close Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Line Timestamp History & Anti-Cheat Drawer */}
      {showTimestampDrawer && (
        <LineTimestampDrawer
          records={lineHistory}
          onClose={() => setShowTimestampDrawer(false)}
        />
      )}

      {/* Leave Session Confirmation Modal (with database reset and demo account deletion) */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <LogOut className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Leave Session & Reset Database?</h2>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Are you sure you want to leave this session? Leaving will clean up session files, remove seeded demo accounts (<code className="text-rose-600 font-mono">interviewer@cse.com</code>, <code className="text-rose-600 font-mono">candidate@cse.com</code>, <code className="text-rose-600 font-mono">admin@cse.com</code>), and reset session data.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                disabled={leaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
              >
                Stay in Session
              </button>
              <button
                type="button"
                onClick={handleLeaveSession}
                disabled={leaving}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {leaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                <span>{leaving ? 'Resetting & Leaving...' : 'Yes, Leave & Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Issue Official Warning</h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Send an authoritative warning notification to candidate <strong>{warningTargetUserName}</strong>. This warning will immediately banner on their screen and be recorded in the session audit timeline.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Warning Message / Reason</label>
              <textarea
                rows={3}
                value={warningText}
                onChange={(e) => setWarningText(e.target.value)}
                placeholder="e.g. Please avoid pasting external solutions or switching tabs."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 transition resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                disabled={warningLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendWarning}
                disabled={warningLoading || !warningText.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {warningLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{warningLoading ? 'Sending Warning...' : 'Dispatch Warning'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Candidate Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Block Candidate for Suspicious Activity?</h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Blocking candidate <strong>{blockTargetUserName}</strong> will immediately freeze their code editor inputs, revoke write permissions, and display an access suspension screen.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Suspicious Activity Reason</label>
              <textarea
                rows={3}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Multiple millisecond copy-paste bursts and unauthorized window defocus detected."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-rose-500 transition resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                disabled={blockLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBlockCandidate}
                disabled={blockLoading || !blockReason.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {blockLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <AlertOctagon className="w-3.5 h-3.5" />}
                <span>{blockLoading ? 'Suspending Access...' : 'Block Candidate Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Friends & Study Buddies Modal */}
      <FriendsModal
        isOpen={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
        currentSessionId={sessionId}
        currentSessionCode={session?.sessionCode}
      />
    </div>
  );
};
