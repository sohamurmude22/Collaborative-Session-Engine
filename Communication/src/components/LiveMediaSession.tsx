import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Minimize2,
  Maximize2,
  Volume2,
  VolumeX,
  AlertTriangle,
  Headphones,
  Signal
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';
import { UserAvatar } from './UserAvatar.js';

interface ParticipantInfo {
  userId: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

interface LiveMediaSessionProps {
  sessionId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  currentUserAvatarUrl?: string;
  sendMessage: (type: string, payload: any) => void;
  lastSocketMessage?: any;
  initialParticipants?: ParticipantInfo[];
  isDocked?: boolean;
  onExpand?: () => void;
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

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

export const LiveMediaSession: React.FC<LiveMediaSessionProps> = ({
  sessionId,
  currentUserId,
  currentUserName,
  currentUserRole,
  currentUserAvatarUrl,
  sendMessage,
  lastSocketMessage,
  initialParticipants = [],
  isDocked = false,
  onExpand
}) => {
  const { themeConfig } = useTheme();

  // Local Media State
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');

  // Remote Peer State
  const [peers, setPeers] = useState<Record<string, PeerMediaState>>(() => {
    const initial: Record<string, PeerMediaState> = {};
    if (initialParticipants && initialParticipants.length > 0) {
      initialParticipants.forEach((p) => {
        if (p.userId && p.userId !== currentUserId) {
          initial[p.userId] = {
            userId: p.userId,
            userName: p.name || 'Collaborator',
            userRole: p.role || 'CANDIDATE',
            avatarUrl: p.avatarUrl,
            isMicOn: false,
            isCamOn: false,
            isSpeaking: false
          };
        }
      });
    }
    return initial;
  });

  // Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const remoteAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const makingOfferRef = useRef<Record<string, boolean>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);

  // Keep references to current state for callbacks
  const isMicOnRef = useRef(isMicOn);
  isMicOnRef.current = isMicOn;
  const isCamOnRef = useRef(isCamOn);
  isCamOnRef.current = isCamOn;
  const isLocalSpeakingRef = useRef(isLocalSpeaking);
  isLocalSpeakingRef.current = isLocalSpeaking;

  // Unblock browser autoplay on any user interaction
  useEffect(() => {
    const unlockAutoplay = () => {
      Object.values(remoteAudioRefs.current).forEach((el) => {
        if (el && el.srcObject) {
          el.play().catch(() => {});
        }
      });
      setAutoplayBlocked(false);
    };

    window.addEventListener('click', unlockAutoplay, { once: true });
    window.addEventListener('keydown', unlockAutoplay, { once: true });
    return () => {
      window.removeEventListener('click', unlockAutoplay);
      window.removeEventListener('keydown', unlockAutoplay);
    };
  }, []);

  // Audio level analyzer to detect local speaking
  const setupAudioActivityDetection = (stream: MediaStream) => {
    try {
      cleanupAudioDetection();
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

        // If average volume is above background floor, mark as speaking
        if (average > 15 && isMicOnRef.current) {
          speakingThresholdCount = Math.min(speakingThresholdCount + 1, 10);
        } else {
          speakingThresholdCount = Math.max(speakingThresholdCount - 1, 0);
        }

        const currentlySpeaking = speakingThresholdCount > 2;
        setIsLocalSpeaking((prev) => {
          if (prev !== currentlySpeaking) {
            sendMessage('MEDIA_STATUS_UPDATE', {
              isMicOn: isMicOnRef.current,
              isCamOn: isCamOnRef.current,
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
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
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
      if (el) {
        el.play().catch(() => {});
      }
    });
    setAutoplayBlocked(false);
  };

  // Create or retrieve Peer Connection for a peer
  const getOrCreatePeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      if (peerConnectionsRef.current[peerId]) {
        const existingPc = peerConnectionsRef.current[peerId];
        if (existingPc.connectionState !== 'closed' && existingPc.signalingState !== 'closed') {
          return existingPc;
        }
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);

      // Add local tracks if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Add transceivers if tracks not yet attached, ensuring audio/video lines in SDP
      const senders = pc.getSenders();
      if (!senders.some((s) => s.track?.kind === 'audio' || (s as any).kind === 'audio')) {
        try {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
        } catch {}
      }
      if (!senders.some((s) => s.track?.kind === 'video' || (s as any).kind === 'video')) {
        try {
          pc.addTransceiver('video', { direction: 'sendrecv' });
        } catch {}
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

      // Connection State monitoring
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnectionStatus('connected');
        } else if (pc.connectionState === 'connecting') {
          setConnectionStatus('connecting');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setConnectionStatus('idle');
        }
      };

      // Remote Track handler: handles both video and audio tracks
      pc.ontrack = (event) => {
        let stream = event.streams[0];
        if (!stream) {
          stream = new MediaStream([event.track]);
        }

        setPeers((prev) => {
          const existing = prev[peerId] || {
            userId: peerId,
            userName: 'Collaborator',
            userRole: 'CANDIDATE',
            isMicOn: true,
            isCamOn: true,
            isSpeaking: false
          };

          // Combine tracks if existing stream was already present
          if (existing.stream && existing.stream !== stream) {
            existing.stream.addTrack(event.track);
            stream = existing.stream;
          }

          return {
            ...prev,
            [peerId]: {
              ...existing,
              stream
            }
          };
        });

        // Synchronize remote video element
        setTimeout(() => {
          const videoEl = remoteVideoRefs.current[peerId];
          if (videoEl && videoEl.srcObject !== stream) {
            videoEl.srcObject = stream;
            videoEl.play().catch(() => {});
          }

          // Synchronize remote audio element (dedicated audio element ensures sound is heard)
          const audioEl = remoteAudioRefs.current[peerId];
          if (audioEl && audioEl.srcObject !== stream) {
            audioEl.srcObject = stream;
            audioEl.volume = 1.0;
            audioEl.muted = false;
            audioEl.play().catch((err) => {
              console.warn('[LiveMedia] Remote audio autoplay blocked:', err);
              setAutoplayBlocked(true);
            });
          }
        }, 50);
      };

      peerConnectionsRef.current[peerId] = pc;
      return pc;
    },
    [sendMessage]
  );

  // Initiate WebRTC Offer
  const initiateOffer = useCallback(
    async (peerId: string) => {
      if (!peerId || peerId === currentUserId) return;
      try {
        makingOfferRef.current[peerId] = true;
        const pc = getOrCreatePeerConnection(peerId);

        // Make sure senders have latest tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => {
            const senders = pc.getSenders();
            const sender = senders.find((s) => s.track?.kind === track.kind || (s as any).kind === track.kind);
            if (sender) {
              sender.replaceTrack(track).catch(() => {});
            } else {
              try {
                pc.addTrack(track, localStreamRef.current!);
              } catch {}
            }
          });
        }

        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);

        sendMessage('WEBRTC_OFFER', {
          targetUserId: peerId,
          offer
        });
      } catch (err) {
        console.warn('[LiveMedia] Offer creation error:', err);
      } finally {
        makingOfferRef.current[peerId] = false;
      }
    },
    [currentUserId, getOrCreatePeerConnection, sendMessage]
  );

  // Sync tracks with all existing peer connections and renegotiate
  const syncTracksToPeers = useCallback(() => {
    if (!localStreamRef.current) return;

    Object.entries(peerConnectionsRef.current).forEach(([peerId, pc]) => {
      if (!pc || pc.connectionState === 'closed') return;

      localStreamRef.current!.getTracks().forEach((track) => {
        const senders = pc.getSenders();
        const sender = senders.find((s) => s.track?.kind === track.kind || (s as any).kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch(() => {});
        } else {
          try {
            pc.addTrack(track, localStreamRef.current!);
          } catch {}
        }
      });

      // Renegotiate so peer receives track update
      initiateOffer(peerId);
    });
  }, [initiateOffer]);

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

        setupAudioActivityDetection(localStreamRef.current!);
        setIsMicOn(true);
        syncTracksToPeers();
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
        isCamOn: isCamOnRef.current,
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

        setIsCamOn(true);
        syncTracksToPeers();
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
        isMicOn: isMicOnRef.current,
        isCamOn: nextState,
        isSpeaking: isLocalSpeakingRef.current
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

        // Broadcast our current status and offer to known peers
        participants.forEach((p: any) => {
          if (p.userId && p.userId !== currentUserId) {
            initiateOffer(p.userId);
          }
        });
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
            isMicOn: isMicOnRef.current,
            isCamOn: isCamOnRef.current,
            isSpeaking: isLocalSpeakingRef.current
          });

          // Initiate WebRTC offer to newcomer
          initiateOffer(joinedUserId);
        }
        break;
      }

      case 'USER_LEFT': {
        const leftUserId = payload?.userId;
        if (leftUserId) {
          if (peerConnectionsRef.current[leftUserId]) {
            try {
              peerConnectionsRef.current[leftUserId].close();
            } catch {}
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
                isMicOn: payload.isMicOn !== undefined ? !!payload.isMicOn : existing.isMicOn,
                isCamOn: payload.isCamOn !== undefined ? !!payload.isCamOn : existing.isCamOn,
                isSpeaking: payload.isSpeaking !== undefined ? !!payload.isSpeaking : existing.isSpeaking
              }
            };
          });

          // Ensure peer connection exists
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
          const isPolite = currentUserId.localeCompare(fromUserId) > 0;
          const offerCollision = makingOfferRef.current[fromUserId] || pc.signalingState !== 'stable';

          if (offerCollision && !isPolite) {
            console.log('[LiveMedia] Glare detected: impolite peer ignoring offer');
            break;
          }

          pc.setRemoteDescription(new RTCSessionDescription(offer))
            .then(async () => {
              // Drain any queued ICE candidates
              const pending = pendingCandidatesRef.current[fromUserId];
              if (pending && pending.length > 0) {
                pending.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
                pendingCandidatesRef.current[fromUserId] = [];
              }

              // Add local tracks to answer if present
              if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                  const senders = pc.getSenders();
                  const sender = senders.find((s) => s.track?.kind === track.kind || (s as any).kind === track.kind);
                  if (sender) {
                    sender.replaceTrack(track).catch(() => {});
                  } else {
                    try {
                      pc.addTrack(track, localStreamRef.current!);
                    } catch {}
                  }
                });
              }

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              sendMessage('WEBRTC_ANSWER', {
                targetUserId: fromUserId,
                answer
              });
            })
            .catch((err) => console.warn('[LiveMedia] WebRTC Answer error:', err));
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
              .catch((err) => console.warn('[LiveMedia] SetRemoteDescription error:', err));
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
  }, [lastSocketMessage, currentUserId, getOrCreatePeerConnection, initiateOffer, sendMessage]);

  // Initial mount: broadcast status and connect to initial participants
  useEffect(() => {
    // Broadcast initial state so everyone knows our media status
    sendMessage('MEDIA_STATUS_UPDATE', {
      isMicOn: false,
      isCamOn: false,
      isSpeaking: false
    });

    if (initialParticipants && initialParticipants.length > 0) {
      initialParticipants.forEach((p) => {
        if (p.userId && p.userId !== currentUserId) {
          initiateOffer(p.userId);
        }
      });
    }

    return () => {
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

  const activePeerList = Object.values(peers);

  // If in docked mini bar mode (when user is in other tabs or focus mode)
  if (isDocked) {
    return (
      <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-slate-900/90 dark:bg-white/[0.04] border border-slate-700/60 dark:border-white/10 text-white backdrop-blur-md shadow-lg text-xs">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMicOn || isCamOn ? 'bg-emerald-400 opacity-75' : 'bg-indigo-400 opacity-40'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isMicOn || isCamOn ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
          </span>
          <span className="font-bold text-[11px] text-slate-200">Live Call</span>
          {activePeerList.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 font-mono text-slate-300">
              {activePeerList.length} Connected
            </span>
          )}
        </div>

        <div className="h-3.5 w-px bg-white/20 mx-0.5" />

        {/* Mic Toggle */}
        <button
          onClick={toggleMic}
          className={`p-1.5 rounded-lg transition cursor-pointer ${
            isMicOn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-white/10 text-slate-300 hover:text-white'
          }`}
          title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
        >
          {isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-rose-400" />}
        </button>

        {/* Cam Toggle */}
        <button
          onClick={toggleCam}
          className={`p-1.5 rounded-lg transition cursor-pointer ${
            isCamOn ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40' : 'bg-white/10 text-slate-300 hover:text-white'
          }`}
          title={isCamOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isCamOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5 text-slate-400" />}
        </button>

        {/* Expand Call */}
        {onExpand && (
          <button
            onClick={onExpand}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
            title="Expand Full Video Call"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Show</span>
          </button>
        )}

        {/* Hidden Remote Audio Elements */}
        {activePeerList.map((peer) => (
          <audio
            key={peer.userId}
            ref={(el) => {
              remoteAudioRefs.current[peer.userId] = el;
              if (el && peer.stream && el.srcObject !== peer.stream) {
                el.srcObject = peer.stream;
                el.volume = 1.0;
                el.muted = false;
                el.play().catch(() => setAutoplayBlocked(true));
              }
            }}
            autoPlay
            playsInline
            className="sr-only"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`transition-all duration-300 ${isMinimized ? 'w-auto' : 'w-full'} shrink-0`}>
      {/* Container Card with Theme Glow */}
      <div
        className={`rounded-2xl border ${themeConfig.border} ${themeConfig.bgCard} p-3 shadow-lg ${
          themeConfig.isDark ? 'bg-slate-900/90' : 'bg-white/95'
        } backdrop-blur-md transition-all duration-200 relative`}
      >
        {/* Header ribbon */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/50 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMicOn || isCamOn ? 'bg-emerald-400 opacity-75' : 'bg-indigo-400 opacity-40'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isMicOn || isCamOn ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
            </span>
            <span className="text-xs font-bold font-heading tracking-tight flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
              <span>Live Collaboration Feed</span>
              {connectionStatus === 'connected' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-0.5">
                  <Signal className="w-2.5 h-2.5" /> P2P Live
                </span>
              )}
              {isLocalSpeaking && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                  <Volume2 className="w-2.5 h-2.5" /> Speaking
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Speaker Sound Check Button */}
            <button
              onClick={playSpeakerTestChime}
              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition cursor-pointer"
              title="Test Speaker Output (Play Test Chime)"
            >
              <Headphones className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition cursor-pointer"
              title={isMinimized ? 'Expand Media' : 'Minimize Media'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Autoplay blocked banner */}
        {autoplayBlocked && (
          <div className="mb-2 p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-[11px] flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1.5">
              <VolumeX className="w-3.5 h-3.5 text-amber-500 shrink-0" />
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
          <div className="mb-2 p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
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
                    : 'border-slate-300/40 dark:border-white/10'
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
                      <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce" />
                      <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse" />
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
                      : 'border-slate-300/40 dark:border-white/10'
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
                        el.volume = 1.0;
                        el.muted = false;
                        el.play().catch((err) => {
                          console.warn('[LiveMedia] Autoplay audio blocked:', err);
                          setAutoplayBlocked(true);
                        });
                      }
                    }}
                    autoPlay
                    playsInline
                    className="sr-only"
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
                        <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce" />
                        <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse" />
                      </div>
                    )}

                    <span className={`p-1 rounded-md text-[10px] ${peer.isMicOn ? 'bg-emerald-500/80 text-white' : 'bg-slate-700/80 text-white'}`}>
                      {peer.isMicOn ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5 text-rose-300" />}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Waiting for peer status notice */}
            {activePeerList.length === 0 && (
              <div className="text-center py-2 px-3 rounded-xl bg-slate-100/50 dark:bg-white/[0.02] border border-dashed border-slate-300 dark:border-white/10">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Waiting for your collaborator to join the workspace...
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Turn on your camera or mic anytime; they will automatically connect.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Controls Toolbar: Mic on/off + Cam on/off */}
        <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-white/10 flex items-center justify-between gap-2">
          {/* Mic Button */}
          <button
            onClick={toggleMic}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm ${
              isMicOn
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
            }`}
            title={isMicOn ? 'Mute Microphone (Mic Off)' : 'Unmute Microphone (Mic On)'}
          >
            {isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-bold">{isMicOn ? 'Mic On' : 'Mic Off'}</span>
          </button>

          {/* Cam Button */}
          <button
            onClick={toggleCam}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm ${
              isCamOn
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                : 'bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10'
            }`}
            title={isCamOn ? 'Turn Off Camera (Cam Off)' : 'Turn On Camera (Cam On)'}
          >
            {isCamOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-bold">{isCamOn ? 'Cam On' : 'Cam Off'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
