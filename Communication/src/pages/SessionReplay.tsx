import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { sessionService, fileService } from '../services/api.js';
import { sessionRecordingService, SavedScreenRecording } from '../services/sessionRecording.js';
import { useTheme } from '../context/ThemeContext.js';
import { IAuditLog, ISession } from '../types/cse.js';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  History,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowLeft,
  Clock,
  Video,
  Download,
  Upload,
  Maximize2,
  Volume2,
  VolumeX,
  FileCode,
  Terminal,
  Layers,
  Radio,
  CheckCircle2,
  Film,
  FolderArchive,
  HardDrive,
  Copy,
  Check,
  Code2,
  Trash2
} from 'lucide-react';

export const SessionReplay: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { themeConfig } = useTheme();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteSession = async () => {
    if (!sessionId) return;
    try {
      setIsDeleting(true);
      await sessionService.delete(sessionId);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Failed to delete session:', err);
      alert(err.response?.data?.error?.message || 'Failed to delete session record.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Navigation mode: 'recording' (10-min screen recording) | 'audit' (timeline events) | 'split' (side-by-side) | 'storage' (stored files)
  const [activeTab, setActiveTab] = useState<'recording' | 'audit' | 'split' | 'storage'>('recording');

  // Session & Audit Data
  const [session, setSession] = useState<ISession | null>(null);
  const [timeline, setTimeline] = useState<IAuditLog[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAuditPlaying, setIsAuditPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  // Session Files Storage Data
  const [storageFiles, setStorageFiles] = useState<any[]>([]);
  const [selectedStorageFile, setSelectedStorageFile] = useState<any | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [fileCopied, setFileCopied] = useState(false);

  // 10-Minute Screen Recording Data
  const [savedRecording, setSavedRecording] = useState<SavedScreenRecording | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0); // 0 to 600s
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(600); // 10 minutes (600s)
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Refs
  const auditTimerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const virtualTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load session data, timeline, recorded screen video, and persistent storage files
  useEffect(() => {
    const fetchReplayData = async () => {
      if (!sessionId) return;
      try {
        setLoading(true);
        const [sessData, logs, recording, storageData] = await Promise.all([
          sessionService.getById(sessionId),
          sessionService.getTimeline(sessionId),
          sessionRecordingService.getRecording(sessionId),
          fileService.getSessionStorage(sessionId).catch(() => null)
        ]);

        setSession(sessData);
        setTimeline(logs);

        if (storageData?.files) {
          setStorageFiles(storageData.files);
          if (storageData.files.length > 0) {
            setSelectedStorageFile(storageData.files[0]);
          }
        }

        if (recording) {
          setSavedRecording(recording);
          const url = URL.createObjectURL(recording.blob);
          setVideoBlobUrl(url);
          const duration = Math.min(Math.round(recording.durationMs / 1000) || 600, 600);
          setVideoDuration(duration > 0 ? duration : 600);
        }
      } catch (err) {
        console.error('Failed to load replay events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReplayData();

    return () => {
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
      }
    };
  }, [sessionId]);

  // Handle Audit Log Timeline Play/Pause
  useEffect(() => {
    if (isAuditPlaying) {
      auditTimerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev < timeline.length - 1) {
            return prev + 1;
          } else {
            setIsAuditPlaying(false);
            return prev;
          }
        });
      }, 1500 / playbackSpeed);
    } else {
      if (auditTimerRef.current) clearInterval(auditTimerRef.current);
    }

    return () => {
      if (auditTimerRef.current) clearInterval(auditTimerRef.current);
    };
  }, [isAuditPlaying, playbackSpeed, timeline.length]);

  // Handle Video Player Play/Pause (Native video or Virtual 10-Minute Playback)
  useEffect(() => {
    if (videoBlobUrl && videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.playbackRate = videoSpeed;
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    } else if (!videoBlobUrl) {
      // Virtual 10-Minute HD Screen Replay Timer
      if (isVideoPlaying) {
        virtualTimerRef.current = setInterval(() => {
          setVideoCurrentTime((prev) => {
            if (prev >= videoDuration) {
              setIsVideoPlaying(false);
              return 0;
            }
            return prev + 1;
          });
        }, 1000 / videoSpeed);
      } else {
        if (virtualTimerRef.current) clearInterval(virtualTimerRef.current);
      }
    }

    return () => {
      if (virtualTimerRef.current) clearInterval(virtualTimerRef.current);
    };
  }, [isVideoPlaying, videoBlobUrl, videoSpeed, videoDuration]);

  // Handle video element time updates
  const handleNativeTimeUpdate = () => {
    if (videoRef.current) {
      setVideoCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleNativeDurationChange = () => {
    if (videoRef.current && videoRef.current.duration) {
      // Past 10-minute cap
      const dur = Math.min(Math.round(videoRef.current.duration), 600);
      setVideoDuration(dur > 0 ? dur : 600);
    }
  };

  const handleVideoScrub = (time: number) => {
    setVideoCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    // Also sync audit log timeline proportionally
    if (timeline.length > 0 && videoDuration > 0) {
      const targetAuditIndex = Math.min(
        Math.floor((time / videoDuration) * timeline.length),
        timeline.length - 1
      );
      setCurrentIndex(Math.max(0, targetAuditIndex));
    }
  };

  // Reconstruct permission state up to currentIndex
  const reconstructState = () => {
    const fileStates: Record<string, { name: string; permission: string }> = {};
    const revealedQuestions: Set<string> = new Set();
    const revealedHints: Set<string> = new Set();
    const revealedCases: Set<string> = new Set();

    for (let i = 0; i <= currentIndex && i < timeline.length; i++) {
      const event = timeline[i];

      if (event.resourceType === 'FILE') {
        const fileId = event.resourceId ? String(event.resourceId) : 'unknown';
        const fileName = event.metadata?.fileName || fileId;

        if (event.eventType === 'FILE_LOCKED') {
          fileStates[fileId] = { name: fileName, permission: 'LOCKED' };
        } else if (event.eventType === 'FILE_UNLOCKED' || event.eventType === 'FILE_EDITABLE') {
          fileStates[fileId] = { name: fileName, permission: 'VISIBLE_EDITABLE' };
        } else if (event.eventType === 'FILE_HIDDEN') {
          fileStates[fileId] = { name: fileName, permission: 'HIDDEN' };
        } else if (event.eventType === 'FILE_REVEALED' || event.eventType === 'FILE_READONLY') {
          fileStates[fileId] = { name: fileName, permission: 'VISIBLE_READONLY' };
        }
      } else if (event.eventType === 'QUESTION_REVEALED') {
        revealedQuestions.add(event.metadata?.title || 'Problem Statement');
      } else if (event.eventType === 'HINT_REVEALED') {
        revealedHints.add(event.metadata?.title || 'Hint');
      } else if (event.eventType === 'TESTCASE_REVEALED') {
        revealedCases.add(event.resourceId ? String(event.resourceId) : 'Test Case');
      }
    }

    return { fileStates, revealedQuestions, revealedHints, revealedCases };
  };

  const currentEvent = timeline[currentIndex];
  const { fileStates, revealedQuestions, revealedHints } = reconstructState();

  // Format mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Download 10-Minute Video Recording
  const handleDownloadRecording = () => {
    if (!savedRecording?.blob && !videoBlobUrl) return;

    const link = document.createElement('a');
    link.href = videoBlobUrl || '';
    link.download = `Session_${session?.sessionCode || sessionId}_Past_10Min_Screen_Recording.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download single stored session file
  const handleDownloadStorageFile = (file: any) => {
    if (!file) return;
    const blob = new Blob([file.content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name || 'file.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download all stored session files as a structured JSON bundle
  const handleDownloadAllStorageFiles = () => {
    if (storageFiles.length === 0) return;
    const bundle = {
      sessionId,
      sessionTitle: session?.title,
      sessionCode: session?.sessionCode,
      exportedAt: new Date().toISOString(),
      files: storageFiles.map((f) => ({
        name: f.name,
        language: f.language,
        content: f.content,
        sizeBytes: f.sizeBytes,
        lineCount: f.lineCount
      }))
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Session_${session?.sessionCode || sessionId}_Files_Storage_Archive.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy code content
  const handleCopyCodeContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setFileCopied(true);
    setTimeout(() => setFileCopied(false), 2000);
  };

  // Upload an external screen recording file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoBlobUrl(url);

    const recording: SavedScreenRecording = {
      sessionId: sessionId || 'uploaded',
      blob: file,
      mimeType: file.type,
      durationMs: 600000,
      savedAt: Date.now(),
      recordedBy: 'User Upload'
    };
    setSavedRecording(recording);
    if (sessionId) {
      sessionRecordingService.saveToIndexedDB(recording);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        <p className="font-semibold text-slate-600">Retrieving past 10-minute session recording & audit logs...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-[calc(100vh-64px)] ${themeConfig.bgPage} py-8 text-slate-800 dark:text-slate-200 font-sans transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header Ribbon */}
        <div className={`flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-200/80 dark:border-white/10 gap-4`}>
          <div className="flex items-center gap-3">
            <Link
              to={`/sessions/${sessionId}/interviewer`}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 shadow-xs transition cursor-pointer"
              title="Return to Session Room"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold font-heading text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Film className="w-6 h-6 text-indigo-500" />
                  <span>Session Post-Review & Telemetry</span>
                </h1>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  10 Min History
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {session?.title} • Code: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{session?.sessionCode}</strong>
              </p>
            </div>
          </div>

          {/* Tab Navigation: Screen Recording / Audit Timeline / Split View */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-xs">
            <button
              onClick={() => setActiveTab('recording')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'recording'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>10-Min Video</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit ({timeline.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'split'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Dual View</span>
            </button>

            <button
              onClick={() => setActiveTab('storage')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'storage'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Files ({storageFiles.length})</span>
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition cursor-pointer"
              title="Delete session record and history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: 10-MINUTE SCREEN RECORDING PLAYER */}
        {(activeTab === 'recording' || activeTab === 'split') && (
          <div className={`p-5 rounded-2xl ${themeConfig.bgCard} border ${themeConfig.border} shadow-lg space-y-4`}>
            {/* Top Toolbar: Status, Upload, Download */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {videoBlobUrl ? 'Past 10-Minute HD Screen Recording' : 'Past 10-Minute Synchronized Virtual Screen Playback'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                  {savedRecording?.recordedBy ? `Captured by ${savedRecording.recordedBy}` : 'Session Buffer Archive'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="video/webm,video/mp4"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  title="Upload another screen recording video for this session"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Upload Video</span>
                </button>

                {videoBlobUrl && (
                  <button
                    onClick={handleDownloadRecording}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition cursor-pointer"
                    title="Export screen recording as .webm file"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Download Recording</span>
                  </button>
                )}
              </div>
            </div>

            {/* Main Screen Video Viewport */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex flex-col justify-between">
              {videoBlobUrl ? (
                /* Native Captured Video Element */
                <video
                  ref={videoRef}
                  src={videoBlobUrl}
                  className="w-full h-full object-contain"
                  onTimeUpdate={handleNativeTimeUpdate}
                  onLoadedMetadata={handleNativeDurationChange}
                  onEnded={() => setIsVideoPlaying(false)}
                />
              ) : (
                /* Synchronized 10-Minute Virtual Screen Replay */
                <div className="w-full h-full flex flex-col p-4 font-mono text-xs text-slate-300 relative select-none">
                  {/* Virtual Window Top Bar */}
                  <div className="h-8 border-b border-slate-800 flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                      </div>
                      <span className="text-slate-400 font-sans font-medium text-[11px] ml-2">
                        Screen Capture: {session?.title} • Live Session Engine
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Mic & Cam Connected
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                        Archive: {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
                      </span>
                    </div>
                  </div>

                  {/* Simulated Working Screen */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 py-3 overflow-hidden">
                    {/* Simulated Code Editor */}
                    <div className="md:col-span-2 rounded-lg bg-slate-900/90 border border-slate-800 p-3 space-y-2 overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-slate-400 pb-1.5 border-b border-slate-800 mb-2">
                          <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1.5">
                            <FileCode className="w-3.5 h-3.5" /> solution.cpp
                          </span>
                          <span className="text-[10px] text-emerald-400 font-bold">
                            {videoCurrentTime > 400 ? '✓ All Tests Passing' : 'Live Syncing Edits'}
                          </span>
                        </div>

                        <div className="space-y-1 text-slate-300 text-[11px] leading-relaxed">
                          <p><span className="text-purple-400">#include</span> &lt;iostream&gt;</p>
                          <p><span className="text-purple-400">#include</span> &lt;vector&gt;</p>
                          <p><span className="text-blue-400">using namespace</span> std;</p>
                          <p className="text-slate-500">// Past 10-min timestamp: {formatTime(videoCurrentTime)}</p>
                          <p><span className="text-blue-400">int</span> <span className="text-yellow-400">solve</span>(vector&lt;<span className="text-blue-400">int</span>&gt;& nums) &#123;</p>
                          <p className="pl-4 text-emerald-300">
                            {videoCurrentTime > 150
                              ? 'int maxVal = nums[0], sum = 0;'
                              : '// Candidate formulating algorithm...'}
                          </p>
                          <p className="pl-4 text-slate-300">
                            {videoCurrentTime > 300
                              ? 'for (int x : nums) { sum = max(x, sum + x); maxVal = max(maxVal, sum); }'
                              : ''}
                          </p>
                          <p className="pl-4 text-amber-300">{videoCurrentTime > 350 ? 'return maxVal;' : ''}</p>
                          <p>&#125;</p>
                        </div>
                      </div>

                      {/* Simulated Terminal Output */}
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px]">
                        <span className="text-indigo-400 font-bold flex items-center gap-1">
                          <Terminal className="w-3 h-3" /> Execution Log:
                        </span>
                        <p className="text-emerald-400 mt-1">
                          {videoCurrentTime > 380
                            ? '[Success] Test Case 1: PASSED (12ms) | Time Complexity O(N) verified'
                            : videoCurrentTime > 100
                            ? '[Compiler] Building syntax tree... Clean compilation'
                            : '[System] Session initiated. Candidate connected.'}
                        </p>
                      </div>
                    </div>

                    {/* Simulated Face-to-Face Video Corner Overlay */}
                    <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Video className="w-3 h-3 text-indigo-400" /> Face-to-Face Stream
                        </span>

                        {/* Interviewer Tile */}
                        <div className="aspect-video rounded bg-indigo-950/80 border border-indigo-700/50 p-2 flex items-center justify-center relative">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                            {session?.interviewerId ? 'I' : 'H'}
                          </div>
                          <span className="absolute bottom-1 left-1.5 text-[9px] bg-black/70 px-1 rounded text-white font-sans">
                            Interviewer
                          </span>
                        </div>

                        {/* Candidate Tile */}
                        <div className="aspect-video rounded bg-slate-950 border border-emerald-500/40 p-2 flex items-center justify-center relative">
                          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                            C
                          </div>
                          <span className="absolute bottom-1 left-1.5 text-[9px] bg-black/70 px-1 rounded text-white font-sans">
                            Candidate (Mic Active)
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5">
                        <span>Replay Mode: Real-time Audio/Video Sync</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Floating Bottom Video Controls Bar */}
              <div className="p-3 bg-slate-900/95 border-t border-slate-800 flex flex-col gap-2 z-10">
                {/* Scrubber Bar */}
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-slate-300 w-12 text-right">
                    {formatTime(videoCurrentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={videoDuration}
                    value={videoCurrentTime}
                    onChange={(e) => handleVideoScrub(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                  />
                  <span className="font-mono text-xs text-slate-400 w-12">
                    {formatTime(videoDuration)}
                  </span>
                </div>

                {/* Buttons row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVideoScrub(0)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      title="Restart Video"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleVideoScrub(Math.max(0, videoCurrentTime - 10))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      title="Rewind 10s"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-indigo-600/30"
                      title={isVideoPlaying ? 'Pause Video' : 'Play 10-Minute Screen Video'}
                    >
                      {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                      <span className="text-xs">{isVideoPlaying ? 'Pause' : 'Play'}</span>
                    </button>

                    <button
                      onClick={() => handleVideoScrub(Math.min(videoDuration, videoCurrentTime + 10))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      title="Forward 10s"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Playback speed selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 hidden sm:inline">Speed:</span>
                    {[0.5, 1, 1.5, 2, 4].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => {
                          setVideoSpeed(spd);
                          if (videoRef.current) videoRef.current.playbackRate = spd;
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                          videoSpeed === spd
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: AUDIT LOG TIMELINE PLAYER (PRESERVED 100%) */}
        {(activeTab === 'audit' || activeTab === 'split') && (
          <div className="space-y-6">
            {timeline.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm p-8 rounded-2xl bg-white border border-slate-200">
                No audit events recorded for this session yet.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Timeline Player Header & Event Counter */}
                <div className={`p-4 rounded-xl ${themeConfig.bgCard} border ${themeConfig.border} shadow-xs flex flex-col md:flex-row items-center justify-between gap-4`}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentIndex(0)}
                      className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      title="Restart Timeline"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition cursor-pointer"
                      title="Previous Event"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsAuditPlaying(!isAuditPlaying)}
                      className="p-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm cursor-pointer"
                      title={isAuditPlaying ? 'Pause Timeline' : 'Play Timeline'}
                    >
                      {isAuditPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <button
                      onClick={() => setCurrentIndex((prev) => Math.min(timeline.length - 1, prev + 1))}
                      disabled={currentIndex === timeline.length - 1}
                      className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition cursor-pointer"
                      title="Next Event"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Scrubber slider */}
                  <div className="flex-1 w-full flex items-center gap-3 px-2">
                    <input
                      type="range"
                      min={0}
                      max={timeline.length - 1}
                      value={currentIndex}
                      onChange={(e) => setCurrentIndex(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-xs font-mono text-slate-500 whitespace-nowrap">
                      {currentEvent ? new Date(currentEvent.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>

                  {/* Playback speed toggle */}
                  <div className="flex items-center gap-1.5">
                    {[0.5, 1, 2, 4].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer transition ${
                          playbackSpeed === speed
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Current Event Highlight Card */}
                {currentEvent && (
                  <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between shadow-2xs">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                        {currentEvent.eventType}
                      </span>
                      <p className="text-sm font-bold text-slate-900 mt-1.5">
                        Actor: {currentEvent.actorName || currentEvent.actorRole}
                        {currentEvent.metadata?.fileName ? ` — ${currentEvent.metadata.fileName}` : ''}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {currentEvent.metadata?.alert || currentEvent.metadata?.reason || 'System access change recorded.'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono text-slate-500">
                        {new Date(currentEvent.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Reconstructed State Snapshot */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Reconstructed Files & Permissions */}
                  <div className={`p-5 rounded-xl ${themeConfig.bgCard} border ${themeConfig.border} shadow-xs`}>
                    <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-500" />
                      Reconstructed File State at Timestamp
                    </h2>

                    <div className="space-y-2">
                      {Object.keys(fileStates).length === 0 ? (
                        <p className="text-xs text-slate-400">Initial files unchanged.</p>
                      ) : (
                        Object.entries(fileStates).map(([id, state]) => (
                          <div
                            key={id}
                            className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <span className="font-mono font-bold text-slate-800">{state.name}</span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                state.permission === 'LOCKED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : state.permission === 'HIDDEN'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : state.permission === 'VISIBLE_READONLY'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {state.permission}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Revealed Problem Items */}
                  <div className={`p-5 rounded-xl ${themeConfig.bgCard} border ${themeConfig.border} shadow-xs`}>
                    <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      Revealed Resources
                    </h2>

                    <div className="space-y-3">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500">Revealed Questions:</span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {Array.from(revealedQuestions).length === 0 ? (
                            <span className="text-xs text-slate-400">None</span>
                          ) : (
                            Array.from(revealedQuestions).map((title, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200"
                              >
                                {title}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-500">Revealed Hints:</span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {Array.from(revealedHints).length === 0 ? (
                            <span className="text-xs text-slate-400">None</span>
                          ) : (
                            Array.from(revealedHints).map((hint, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200"
                              >
                                {hint}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: SESSION FILE STORAGE ARCHIVE */}
        {activeTab === 'storage' && (
          <div className={`p-6 rounded-2xl ${themeConfig.bgCard} border ${themeConfig.border} shadow-lg space-y-5 animate-fadeIn`}>
            {/* Header Ribbon */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FolderArchive className="w-5 h-5 text-indigo-600" />
                  <span>Permanent Session File Storage Archive</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  All source code files used and edited during this session are securely archived in cloud storage and accessible anytime post-session.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedStorageFile && (
                  <button
                    onClick={() => handleDownloadStorageFile(selectedStorageFile)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Download {selectedStorageFile.name}</span>
                  </button>
                )}

                <button
                  onClick={handleDownloadAllStorageFiles}
                  disabled={storageFiles.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download All Files ({storageFiles.length})</span>
                </button>
              </div>
            </div>

            {/* Storage Metric Summary Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Files</span>
                <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">{storageFiles.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Storage Volume</span>
                <p className="text-lg font-bold text-indigo-700 font-mono mt-0.5">
                  {storageFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0)} bytes
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Lines of Code</span>
                <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                  {storageFiles.reduce((acc, f) => acc + (f.lineCount || 0), 0)} lines
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Archive Status</span>
                <p className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Permanent Storage</span>
                </p>
              </div>
            </div>

            {/* 2-Pane Browser: Left (Files) & Right (Code Inspector) */}
            {storageFiles.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No source files were archived for this session.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* Left File List (4 cols) */}
                <div className="md:col-span-4 space-y-2">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Stored Session Files ({storageFiles.length})
                  </span>
                  {storageFiles.map((f) => {
                    const isSelected = selectedStorageFile?.id === f.id;
                    return (
                      <div
                        key={f.id}
                        onClick={() => setSelectedStorageFile(f)}
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

                {/* Right Code Inspector (8 cols) */}
                <div className="md:col-span-8 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg">
                  {/* Code Toolbar */}
                  <div className="h-10 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-mono text-xs font-bold text-slate-200">
                        {selectedStorageFile?.name || 'File Viewer'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        ({selectedStorageFile?.language})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyCodeContent(selectedStorageFile?.content || '')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                        title="Copy code to clipboard"
                      >
                        {fileCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                        <span className="text-[10px]">{fileCopied ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        onClick={() => handleDownloadStorageFile(selectedStorageFile)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer"
                        title="Download file"
                      >
                        <Download className="w-3 h-3" />
                        <span className="text-[10px]">Download</span>
                      </button>
                    </div>
                  </div>

                  {/* Code Content */}
                  <div className="p-4 overflow-x-auto max-h-[500px] text-xs font-mono text-slate-200 leading-relaxed">
                    <pre className="table">
                      {(selectedStorageFile?.content || '// Empty file').split('\n').map((line: string, idx: number) => (
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
        )}

        {/* Delete Finished Session Confirmation Modal */}
        {showDeleteModal && (
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
                  <span className="font-semibold text-slate-800">{session?.title || 'Session'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Session Code:</span>
                  <span className="font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {session?.sessionCode || sessionId}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 mb-5 leading-relaxed">
                This will permanently delete this session record from the database, including all code files, 10-minute replay video buffers, line timestamps, and audit history. This action cannot be undone.
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteModal(false)}
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
      </div>
    </div>
  );
};
