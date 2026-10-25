import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Radio,
  Minimize2,
  Maximize2,
  Volume2,
  VolumeX,
  Sparkles,
  ScreenShare,
  AlertTriangle,
  Headphones
} from 'lucide-react';
import { sessionRecordingService } from '../services/sessionRecording.js';
import { useTheme } from '../context/ThemeContext.js';
import { UserAvatar } from './UserAvatar.js';

interface LiveMediaSessionProps {
  sessionId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  currentUserAvatarUrl?: string;
  sendMessage: (type: string, payload: any) => void;
  lastSocketMessage?: any;
  onRecordingStateChange?: (recording: boolean) => void;
}

interface PeerMediaState {
  userId: string;
  userName: string;
  userRole: string;
  avatarUrl?: string;
  isMicOn: boolean;
  isCamOn: boolean;
  isSpeaking: boolean;
  stream?: MediaStream;
}

export const LiveMediaSession: React.FC<LiveMediaSessionProps> = ({
  sessionId,
  currentUserId,
  currentUserName,
  currentUserRole,
  currentUserAvatarUrl,
  sendMessage,
  lastSocketMessage,
  onRecordingStateChange
}) => {
  const { themeConfig } = useTheme();

  // Local Media State
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Screen recording state
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Remote Peer State
  const [peers, setPeers] = useState<Record<string, PeerMediaState>>({});

  // Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const remoteAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<any>(null);

  // Check initial screen recording state
  useEffect(() => {
    setIsScreenRecording(sessionRecordingService.getIsRecording());
  }, []);

  // Timer for screen recording duration display
  useEffect(() => {
    if (isScreenRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingSeconds(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isScreenRecording]);

  // Audio level analyzer to detect speaking ("mouth to mouth")
  const setupAudioActivityDetection = (stream: MediaStream) => {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let speakingThresholdCount = 0;

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // If average volume is above sound floor, mark as speaking
        if (average > 14) {
          speakingThresholdCount = Math.min(speakingThresholdCount + 1, 10);
        } else {
          speakingThresholdCount = Math.max(speakingThresholdCount - 1, 0);
        }

        const currentlySpeaking = speakingThresholdCount > 2;
        setIsLocalSpeaking((prev) => {
          if (prev !== currentlySpeaking) {
            sendMessage('MEDIA_STATUS_UPDATE', {
              isMicOn,
              isCamOn,
              isSpeaking: currentlySpeaking
            });
          }
          return currentlySpeaking;
        });

        micAnimFrameRef.current = requestAnimationFrame(checkVolume);
      };

      micAnimFrameRef.current = requestAnimationFrame(checkVolume);
    } catch (err) {
      console.warn('[LiveMedia] Audio level detection skipped:', err);
    }
  };

  const cleanupAudioDetection = () => {
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsLocalSpeaking(false);
  };

  // Speaker Test Chime: verifies that user's speakers/headphones are functioning properly
  const playSpeakerTestChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.24); // G5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (err) {
      console.warn('Audio test chime error:', err);
    }
  };

  // Browser Autoplay unblock button
  const handleEnableSound = () => {
    Object.values(remoteAudioRefs.current).forEach((el) => {
      if (el) el.play().catch(() => {});
    });
    setAutoplayBlocked(false);
  };

  // Create or retrieve Peer Connection for a peer
  const getOrCreatePeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    if (peerConnectionsRef.current[peerId]) {
      return peerConnectionsRef.current[peerId];
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    // Add transceivers for both audio and video so channels exist bidirectionally
    try {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
    } catch (err) {
      console.warn('[LiveMedia] addTransceiver fallback:', err);
    }

    // Add local tracks if already available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        const senders = pc.getSenders();
        const match = senders.find((s) => s.track?.kind === track.kind || (s as any).kind === track.kind);
        if (match) {
          match.replaceTrack(track).catch(() => {});
        } else {
          pc.addTrack(track, localStreamRef.current!);
        }
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage('WEBRTC_ICE_CANDIDATE', {
          targetUserId: peerId,
          candidate: event.candidate
        });
      }
    };

    // Remote Track handler: handles both video and audio tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      setPeers((prev) => {
        const existing = prev[peerId] || {
          userId: peerId,
          userName: 'Collaborator',
          userRole: 'CANDIDATE',
          isMicOn: false,
          isCamOn: true,
          isSpeaking: false
        };
        return {
          ...prev,
          [peerId]: {
            ...existing,
            stream: remoteStream,
            isCamOn: existing.isCamOn
          }
        };
      });

      // Synchronize video element
      setTimeout(() => {
        const videoEl = remoteVideoRefs.current[peerId];
        if (videoEl && videoEl.srcObject !== remoteStream) {
          videoEl.srcObject = remoteStream;
        }

        // Synchronize separate audio element so sound is NEVER muted by hidden video
        const audioEl = remoteAudioRefs.current[peerId];
        if (audioEl && audioEl.srcObject !== remoteStream) {
          audioEl.srcObject = remoteStream;
          audioEl.play().catch((err) => {
            console.warn('[LiveMedia] Audio autoplay blocked:', err);
            setAutoplayBlocked(true);
          });
        }
      }, 50);
    };

    peerConnectionsRef.current[peerId] = pc;
    return pc;
  }, [sendMessage]);

  // Initiate WebRTC Call Offer to a Peer
  const initiateOffer = useCallback(async (peerId: string) => {
    try {
      const pc = getOrCreatePeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendMessage('WEBRTC_OFFER', {
        targetUserId: peerId,
        offer
      });
    } catch (err) {
      console.warn('[LiveMedia] Offer creation error:', err);
    }
  }, [getOrCreatePeerConnection, sendMessage]);

  // Toggle Microphone
  const toggleMic = async () => {
    const nextState = !isMicOn;
    setMediaError(null);

    try {
      if (nextState) {
        let audioTrack: MediaStreamTrack | null = null;
        if (!localStreamRef.current || localStreamRef.current.getAudioTracks().length === 0) {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
          audioTrack = micStream.getAudioTracks()[0];
          if (localStreamRef.current) {
            localStreamRef.current.addTrack(audioTrack);
          } else {
            localStreamRef.current = micStream;
          }
        } else {
          audioTrack = localStreamRef.current.getAudioTracks()[0];
          audioTrack.enabled = true;
        }

        // Add or replace track to existing peer connections
        if (audioTrack) {
          Object.values(peerConnectionsRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'audio' || (s as any).kind === 'audio');
            if (sender) {
              sender.replaceTrack(audioTrack).catch(() => {});
            } else {
              pc.addTrack(audioTrack!, localStreamRef.current!);
            }
          });
        }

        setupAudioActivityDetection(localStreamRef.current!);
        setIsMicOn(true);
      } else {
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
        }
        cleanupAudioDetection();
        setIsMicOn(false);
      }

      sendMessage('MEDIA_STATUS_UPDATE', {
        isMicOn: nextState,
        isCamOn,
        isSpeaking: false
      });
    } catch (err: any) {
      console.error('[LiveMedia] Mic access error:', err);
      setMediaError(err.name === 'NotAllowedError' ? 'Microphone permission blocked.' : 'Microphone unavailable.');
      setIsMicOn(false);
    }
  };

  // Toggle Camera
  const toggleCam = async () => {
    const nextState = !isCamOn;
    setMediaError(null);

    try {
      if (nextState) {
        let videoTrack: MediaStreamTrack | null = null;
        if (!localStreamRef.current || localStreamRef.current.getVideoTracks().length === 0) {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 360 } }
          });
          videoTrack = videoStream.getVideoTracks()[0];
          if (localStreamRef.current) {
            localStreamRef.current.addTrack(videoTrack);
          } else {
            localStreamRef.current = videoStream;
          }
        } else {
          videoTrack = localStreamRef.current.getVideoTracks()[0];
          videoTrack.enabled = true;
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        // Replace track on peers for instant 0ms latency update
        if (videoTrack) {
          Object.values(peerConnectionsRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video' || (s as any).kind === 'video');
            if (sender) {
              sender.replaceTrack(videoTrack).catch(() => {});
            } else {
              pc.addTrack(videoTrack!, localStreamRef.current!);
            }
          });
        }
        setIsCamOn(true);
      } else {
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach((t) => {
            t.enabled = false;
          });
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
        setIsCamOn(false);
      }

      sendMessage('MEDIA_STATUS_UPDATE', {
        isMicOn,
        isCamOn: nextState,
        isSpeaking: isLocalSpeaking
      });
    } catch (err: any) {
      console.error('[LiveMedia] Camera access error:', err);
      setMediaError(err.name === 'NotAllowedError' ? 'Camera permission blocked.' : 'Camera unavailable.');
      setIsCamOn(false);
    }
  };

  // Handle incoming WebSocket media and WebRTC messages
  useEffect(() => {
    if (!lastSocketMessage) return;

    const { type, payload } = lastSocketMessage;

    switch (type) {
      case 'SESSION_STATE': {
        const participants = payload?.participants || [];
        setPeers((prev) => {
          const next = { ...prev };
          participants.forEach((p: any) => {
            const pid = p.userId;
            if (pid && pid !== currentUserId) {
              if (!next[pid]) {
                next[pid] = {
                  userId: pid,
                  userName: p.name || 'Collaborator',
                  userRole: p.role || 'CANDIDATE',
                  avatarUrl: p.avatarUrl,
                  isMicOn: false,
                  isCamOn: false,
                  isSpeaking: false
                };
              } else if (p.avatarUrl) {
                next[pid].avatarUrl = p.avatarUrl;
              }
            }
          });
          return next;
        });

        // Trigger offer if we have active media
        if (isMicOn || isCamOn) {
          participants.forEach((p: any) => {
            if (p.userId && p.userId !== currentUserId) {
              initiateOffer(p.userId);
            }
          });
        }
        break;
      }

      case 'USER_JOINED': {
        const joinedUserId = payload?.userId;
        if (joinedUserId && joinedUserId !== currentUserId) {
          setPeers((prev) => ({
            ...prev,
            [joinedUserId]: {
              userId: joinedUserId,
              userName: payload.name || 'Collaborator',
              userRole: payload.role || 'CANDIDATE',
              avatarUrl: payload.avatarUrl,
              isMicOn: false,
              isCamOn: false,
              isSpeaking: false
            }
          }));

          // Send our media status to newcomer
          sendMessage('MEDIA_STATUS_UPDATE', {
            isMicOn,
            isCamOn,
            isSpeaking: isLocalSpeaking
          });

          // Always initiate WebRTC offer so both sides can see and hear each other
          initiateOffer(joinedUserId);
        }
        break;
      }

      case 'USER_LEFT': {
        const leftUserId = payload?.userId;
        if (leftUserId) {
          if (peerConnectionsRef.current[leftUserId]) {
            peerConnectionsRef.current[leftUserId].close();
            delete peerConnectionsRef.current[leftUserId];
          }
          setPeers((prev) => {
            const next = { ...prev };
            delete next[leftUserId];
            return next;
          });
        }
        break;
      }

      case 'MEDIA_STATUS_UPDATE': {
        const peerId = payload?.userId;
        if (peerId && peerId !== currentUserId) {
          setPeers((prev) => {
            const existing = prev[peerId] || {
              userId: peerId,
              userName: payload.userName || 'Peer',
              userRole: payload.userRole || 'CANDIDATE',
              avatarUrl: payload.avatarUrl,
              isMicOn: false,
              isCamOn: false,
              isSpeaking: false
            };
            return {
              ...prev,
              [peerId]: {
                ...existing,
                userName: payload.userName || existing.userName,
                userRole: payload.userRole || existing.userRole,
                avatarUrl: payload.avatarUrl || existing.avatarUrl,
                isMicOn: payload.isMicOn !== undefined ? payload.isMicOn : existing.isMicOn,
                isCamOn: payload.isCamOn !== undefined ? payload.isCamOn : existing.isCamOn,
                isSpeaking: payload.isSpeaking !== undefined ? payload.isSpeaking : existing.isSpeaking
              }
            };
          });

          // If no connection exists yet with this peer, offer
          if (!peerConnectionsRef.current[peerId]) {
            initiateOffer(peerId);
          }
        }
        break;
      }

      case 'WEBRTC_OFFER': {
        const { fromUserId, targetUserId, offer } = payload || {};
        if (targetUserId && targetUserId !== currentUserId) break;
        if (fromUserId && fromUserId !== currentUserId && offer) {
          const pc = getOrCreatePeerConnection(fromUserId);
          pc.setRemoteDescription(new RTCSessionDescription(offer))
            .then(async () => {
              // Drain any queued ICE candidates
              const pending = pendingCandidatesRef.current[fromUserId];
              if (pending && pending.length > 0) {
                pending.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
                pendingCandidatesRef.current[fromUserId] = [];
              }
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sendMessage('WEBRTC_ANSWER', {
                targetUserId: fromUserId,
                answer
              });
            })
            .catch((err) => console.warn('[LiveMedia] Answer error:', err));
        }
        break;
      }

      case 'WEBRTC_ANSWER': {
        const { fromUserId, targetUserId, answer } = payload || {};
        if (targetUserId && targetUserId !== currentUserId) break;
        if (fromUserId && fromUserId !== currentUserId && answer) {
          const pc = peerConnectionsRef.current[fromUserId];
          if (pc && pc.signalingState !== 'stable') {
            pc.setRemoteDescription(new RTCSessionDescription(answer))
              .then(() => {
                const pending = pendingCandidatesRef.current[fromUserId];
                if (pending && pending.length > 0) {
                  pending.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
                  pendingCandidatesRef.current[fromUserId] = [];
                }
              })
              .catch((err) =>
                console.warn('[LiveMedia] SetRemoteDescription error:', err)
              );
          }
        }
        break;
      }

      case 'WEBRTC_ICE_CANDIDATE': {
        const { fromUserId, targetUserId, candidate } = payload || {};
        if (targetUserId && targetUserId !== currentUserId) break;
        if (fromUserId && fromUserId !== currentUserId && candidate) {
          const pc = peerConnectionsRef.current[fromUserId];
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) =>
              console.warn('[LiveMedia] ICE candidate error:', err)
            );
          } else {
            pendingCandidatesRef.current[fromUserId] = pendingCandidatesRef.current[fromUserId] || [];
            pendingCandidatesRef.current[fromUserId].push(candidate);
          }
        }
        break;
      }

      default:
        break;
    }
  }, [lastSocketMessage, currentUserId, isMicOn, isCamOn, isLocalSpeaking, getOrCreatePeerConnection, initiateOffer, sendMessage]);

  // Auto-start Camera and Microphone on session mount so both sides have active video & audio
  useEffect(() => {
    let active = true;

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setIsCamOn(true);
        setIsMicOn(true);
        setupAudioActivityDetection(stream);

        sendMessage('MEDIA_STATUS_UPDATE', {
          isMicOn: true,
          isCamOn: true,
          isSpeaking: false
        });

        // Attach tracks to peer connections
        stream.getTracks().forEach((track) => {
          Object.values(peerConnectionsRef.current).forEach((pc) => {
            const senders = pc.getSenders();
            const match = senders.find((s) => s.track?.kind === track.kind || (s as any).kind === track.kind);
            if (match) {
              match.replaceTrack(track).catch(() => {});
            } else {
              pc.addTrack(track, stream);
            }
          });
        });
      } catch (err: any) {
        console.warn('[LiveMedia] Video+audio auto-start fallback:', err);
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
          if (!active) {
            audioStream.getTracks().forEach((t) => t.stop());
            return;
          }
          localStreamRef.current = audioStream;
          setIsMicOn(true);
          setupAudioActivityDetection(audioStream);
          sendMessage('MEDIA_STATUS_UPDATE', {
            isMicOn: true,
            isCamOn: false,
            isSpeaking: false
          });
        } catch (audioErr) {
          console.warn('[LiveMedia] Audio fallback error:', audioErr);
        }
      }
    };

    startMedia();

    return () => {
      active = false;
      cleanupAudioDetection();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        try {
          pc.close();
        } catch {}
      });
      peerConnectionsRef.current = {};
    };
  }, []);


  // Screen recording toggle
  const handleToggleScreenRecording = async () => {
    if (isScreenRecording) {
      const saved = await sessionRecordingService.stopRecordingAndSave(sessionId, currentUserName);
      setIsScreenRecording(false);
      onRecordingStateChange?.(false);
      if (saved) {
        sendMessage('RECORDING_SAVED', {
          durationMs: saved.durationMs,
          message: 'Screen recording of the past 10 minutes saved for Session Replay.'
        });
      }
    } else {
      const started = await sessionRecordingService.startRecording(sessionId);
      if (started) {
        setIsScreenRecording(true);
        onRecordingStateChange?.(true);
      }
    }
  };

  const formatRecDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activePeerList = Object.values(peers);

  return (
    <div className={`transition-all duration-300 ${isMinimized ? 'w-auto' : 'w-full'} shrink-0`}>
      {/* Container Card with Theme Glow */}
      <div
        className={`rounded-2xl border ${themeConfig.border} ${themeConfig.bgCard} p-3 shadow-lg ${
          themeConfig.isDark ? 'bg-slate-900/90' : 'bg-white/95'
        } backdrop-blur-md transition-all duration-200 relative`}
      >
        {/* Header ribbon */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/50">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMicOn || isCamOn ? 'bg-emerald-400 opacity-75' : 'bg-indigo-400 opacity-40'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isMicOn || isCamOn ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
            </span>
            <span className="text-xs font-bold font-heading tracking-tight flex items-center gap-1.5">
              <span>Live Collaboration Feed</span>
              {isLocalSpeaking && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                  <Volume2 className="w-2.5 h-2.5" /> Speaking
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Speaker Sound Check Button */}
            <button
              onClick={playSpeakerTestChime}
              className="p-1 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
              title="Test Speaker Output (Play Test Chime)"
            >
              <Headphones className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
              title={isMinimized ? 'Expand Media' : 'Minimize Media'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Autoplay blocked banner */}
        {autoplayBlocked && (
          <div className="mb-2 p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-[11px] flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1.5">
              <VolumeX className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Audio blocked by browser policy.</span>
            </div>
            <button
              onClick={handleEnableSound}
              className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] cursor-pointer"
            >
              Enable Sound
            </button>
          </div>
        )}

        {/* Media Error Message if device blocked */}
        {mediaError && (
          <div className="mb-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{mediaError} Check browser permissions.</span>
          </div>
        )}

        {/* Expanded View: Video feeds & Face-to-Face communication */}
        {!isMinimized && (
          <div className="space-y-3">
            {/* Grid of video / avatar tiles: You + Remote Peers */}
            <div className={`grid ${activePeerList.length > 0 ? 'grid-cols-2 gap-2' : 'grid-cols-1'} items-center`}>
              {/* Local Participant Tile */}
              <div
                className={`relative aspect-video rounded-xl overflow-hidden border ${
                  isLocalSpeaking
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'border-slate-300/40'
                } bg-slate-950 flex flex-col items-center justify-center transition-all duration-200`}
              >
                {/* Local Video Stream */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isCamOn ? 'block scale-x-[-1]' : 'hidden'}`}
                />

                {/* Avatar Placeholder when Camera is Off */}
                {!isCamOn && (
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <UserAvatar
                      name={currentUserName}
                      avatarUrl={currentUserAvatarUrl}
                      size="md"
                      isOnline={true}
                    />
                    <span className="text-[10px] text-slate-400 mt-1.5 font-medium">Camera Off</span>
                  </div>
                )}

                {/* Status Badges Overlay */}
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-xs">
                    You ({currentUserRole})
                  </span>
                </div>

                <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
                  {/* Speaking indicator sound bars */}
                  {isLocalSpeaking && (
                    <div className="flex items-end gap-0.5 h-3 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50">
                      <span className="w-0.5 bg-emerald-400 rounded-full wave-bar-1" />
                      <span className="w-0.5 bg-emerald-400 rounded-full wave-bar-2" />
                      <span className="w-0.5 bg-emerald-400 rounded-full wave-bar-3" />
                      <span className="w-0.5 bg-emerald-400 rounded-full wave-bar-4" />
                    </div>
                  )}

                  <span className={`p-1 rounded-md text-[10px] ${isMicOn ? 'bg-emerald-500/80 text-white' : 'bg-rose-500/80 text-white'}`}>
                    {isMicOn ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
                  </span>
                </div>
              </div>

              {/* Remote Peer Tiles (Face-to-Face) */}
              {activePeerList.map((peer) => (
                <div
                  key={peer.userId}
                  className={`relative aspect-video rounded-xl overflow-hidden border ${
                    peer.isSpeaking
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'border-slate-300/40'
                  } bg-slate-950 flex flex-col items-center justify-center transition-all duration-200`}
                >
                  {/* Remote video element */}
                  <video
                    ref={(el) => {
                      remoteVideoRefs.current[peer.userId] = el;
                      if (el && peer.stream && el.srcObject !== peer.stream) {
                        el.srcObject = peer.stream;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${peer.isCamOn && peer.stream ? 'block' : 'hidden'}`}
                  />

                  {/* Dedicated audio element ensuring voice is audible regardless of camera state */}
                  <audio
                    ref={(el) => {
                      remoteAudioRefs.current[peer.userId] = el;
                      if (el && peer.stream && el.srcObject !== peer.stream) {
                        el.srcObject = peer.stream;
                        el.play().catch((err) => {
                          console.warn('[LiveMedia] Autoplay audio blocked:', err);
                          setAutoplayBlocked(true);
                        });
                      }
                    }}
                    autoPlay
                    playsInline
                    className="hidden"
                  />

                  {/* Remote Avatar Placeholder */}
                  {(!peer.isCamOn || !peer.stream) && (
                    <div className="flex flex-col items-center justify-center p-2 text-center">
                      <UserAvatar
                        name={peer.userName}
                        avatarUrl={peer.avatarUrl}
                        size="md"
                        isOnline={true}
                      />
                      <span className="text-[10px] text-slate-400 mt-1.5 font-medium">{peer.userName}</span>
                    </div>
                  )}

                  {/* Peer overlay tags */}
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-xs">
                      {peer.userName}
                    </span>
                  </div>

                  <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
                    {peer.isSpeaking && (
                      <div className="flex items-end gap-0.5 h-3 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50">
                        <span className="w-0.5 bg-emerald-400 rounded-full wave-bar-1" />
                        <span className="w-0.5 bg-emerald-400 rounded-full wave-bar-2" />
                        <span className="w-0.5 bg-emerald-400 rounded-full wave-bar-3" />
                      </div>
                    )}

                    <span className={`p-1 rounded-md text-[10px] ${peer.isMicOn ? 'bg-emerald-500/80 text-white' : 'bg-slate-700/80 text-white'}`}>
                      {peer.isMicOn ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Waiting for peer status notice */}
            {activePeerList.length === 0 && (
              <div className="text-center py-1">
                <p className="text-[10px] text-slate-400">
                  Waiting for interviewer/candidate to connect audio & video...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Controls Toolbar: Mic on/off + Cam on/off + Screen Record */}
        <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center justify-between gap-1.5">
          {/* Mic Button */}
          <button
            onClick={toggleMic}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm ${
              isMicOn
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
            title={isMicOn ? 'Mute Microphone (Mic Off)' : 'Unmute Microphone (Mic On)'}
          >
            {isMicOn ? <Mic className="w-3.5 h-3.5 animate-pulse" /> : <MicOff className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{isMicOn ? 'Mic On' : 'Mic Off'}</span>
          </button>

          {/* Cam Button */}
          <button
            onClick={toggleCam}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm ${
              isCamOn
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
            title={isCamOn ? 'Turn Off Camera (Cam Off)' : 'Turn On Camera (Cam On)'}
          >
            {isCamOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{isCamOn ? 'Cam On' : 'Cam Off'}</span>
          </button>

          {/* Screen Recording Toggle (Past 10-Minute Buffer) */}
          <button
            onClick={handleToggleScreenRecording}
            className={`items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm flex ${
              isScreenRecording
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
            }`}
            title={
              isScreenRecording
                ? 'Stop & Save Past 10-Min Screen Recording'
                : 'Record Screen Buffer (Saves past 10 min for session replay)'
            }
          >
            <ScreenShare className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono font-bold">
              {isScreenRecording ? `REC ${formatRecDuration(recordingSeconds)}` : '10m Rec'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
