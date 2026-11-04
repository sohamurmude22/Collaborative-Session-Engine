import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Minimize2,
  Maximize2,
  Volume2,
  VolumeX,
  AlertTriangle,
  Headphones,
  Signal,
  RefreshCw,
  Radio
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
  addSocketListener?: (listener: (msg: any) => void) => () => void;
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
  isSpeaking: boolean;
  stream?: MediaStream;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
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
  addSocketListener,
  initialParticipants = [],
  isDocked = false,
  onExpand
}) => {
  const { themeConfig } = useTheme();

  // Local Voice State
  const [isMicOn, setIsMicOn] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Remote Peers State
  const [peers, setPeers] = useState<Record<string, PeerMediaState>>(() => {
    const initial: Record<string, PeerMediaState> = {};
    if (initialParticipants && initialParticipants.length > 0) {
      initialParticipants.forEach((p) => {
        if (p.userId && String(p.userId) !== String(currentUserId)) {
          initial[p.userId] = {
            userId: p.userId,
            userName: p.name || 'Collaborator',
            userRole: p.role || 'CANDIDATE',
            avatarUrl: p.avatarUrl,
            isMicOn: false,
            isSpeaking: false
          };
        }
      });
    }
    return initial;
  });

  // Audio Pipeline & WebRTC Refs
  const remoteAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const localRawAudioStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const makingOfferRef = useRef<Record<string, boolean>>({});

  // Local Speech Level Analyser (visual only - never muting)
  const localAudioCtxRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const localAnimFrameRef = useRef<number | null>(null);

  // State mirror refs for event callbacks
  const isMicOnRef = useRef(isMicOn);
  isMicOnRef.current = isMicOn;
  const isLocalSpeakingRef = useRef(isLocalSpeaking);
  isLocalSpeakingRef.current = isLocalSpeaking;
  const peersRef = useRef(peers);
  peersRef.current = peers;

  // Unblock browser autoplay on any user interaction
  useEffect(() => {
    const unlockAutoplay = () => {
      Object.values(remoteAudioRefs.current).forEach((el) => {
        if (el && el.srcObject) {
          el.muted = false;
          el.play().catch(() => {});
        }
      });
      setAutoplayBlocked(false);
    };

    window.addEventListener('click', unlockAutoplay, { once: true });
    window.addEventListener('keydown', unlockAutoplay, { once: true });
    window.addEventListener('touchstart', unlockAutoplay, { once: true });
    return () => {
      window.removeEventListener('click', unlockAutoplay);
      window.removeEventListener('keydown', unlockAutoplay);
      window.removeEventListener('touchstart', unlockAutoplay);
    };
  }, []);

  // Sync remote streams to audio elements on peers state change
  useEffect(() => {
    Object.entries(peers).forEach(([peerId, peer]) => {
      const stream = peer.stream || remoteStreamsRef.current[peerId];
      if (stream) {
        const audioEl = remoteAudioRefs.current[peerId];
        if (audioEl) {
          if (audioEl.srcObject !== stream) {
            audioEl.srcObject = stream;
          }
          audioEl.volume = 1.0;
          audioEl.muted = false;
          audioEl.play().catch(() => setAutoplayBlocked(true));
        }
      }
    });
  }, [peers]);

  // Setup local visual speech detector
  const setupSpeechDetector = useCallback((stream: MediaStream) => {
    cleanupSpeechDetector();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      localAudioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      localAnalyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let speakingFrames = 0;

      const checkVolume = () => {
        if (!localAnalyserRef.current) return;
        localAnalyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;

        // Sensitivity threshold: human speech is typically avg > 10
        const isAboveFloor = avg > 10;
        if (isAboveFloor && isMicOnRef.current) {
          speakingFrames = Math.min(speakingFrames + 1, 8);
        } else {
          speakingFrames = Math.max(speakingFrames - 1, 0);
        }

        const currentlySpeaking = speakingFrames > 1;
        setIsLocalSpeaking((prev) => {
          if (prev !== currentlySpeaking) {
            sendMessage('MEDIA_STATUS_UPDATE', {
              isMicOn: isMicOnRef.current,
              isSpeaking: currentlySpeaking
            });
          }
          return currentlySpeaking;
        });

        localAnimFrameRef.current = requestAnimationFrame(checkVolume);
      };

      localAnimFrameRef.current = requestAnimationFrame(checkVolume);
    } catch (err) {
      console.warn('[LiveMedia] Speech detector init error:', err);
    }
  }, [sendMessage]);

  const cleanupSpeechDetector = () => {
    if (localAnimFrameRef.current) {
      cancelAnimationFrame(localAnimFrameRef.current);
      localAnimFrameRef.current = null;
    }
    if (localAudioCtxRef.current) {
      try {
        localAudioCtxRef.current.close();
      } catch {}
      localAudioCtxRef.current = null;
    }
    localAnalyserRef.current = null;
    setIsLocalSpeaking(false);
  };

  // Test Speaker Chime: verifies that user's speakers/headphones are functioning properly
  const playSpeakerTestChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.24); // G5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (err) {
      console.warn('Audio test chime error:', err);
    }
  };

  const handleEnableSound = () => {
    Object.values(remoteAudioRefs.current).forEach((el) => {
      if (el) {
        el.muted = false;
        el.volume = 1.0;
        el.play().catch(() => {});
      }
    });
    setAutoplayBlocked(false);
  };

  // Helper: get or create remote persistent MediaStream for a peer
  const getOrCreateRemoteStream = useCallback((peerId: string): MediaStream => {
    if (!remoteStreamsRef.current[peerId]) {
      remoteStreamsRef.current[peerId] = new MediaStream();
    }
    return remoteStreamsRef.current[peerId];
  }, []);

  // Create or retrieve Peer Connection for a peer (Audio-only)
  const getOrCreatePeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      if (peerConnectionsRef.current[peerId]) {
        const existingPc = peerConnectionsRef.current[peerId];
        if (existingPc.connectionState !== 'closed' && existingPc.signalingState !== 'closed') {
          return existingPc;
        }
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      const remoteStream = getOrCreateRemoteStream(peerId);

      // Attach existing local audio track if mic is on
      if (localRawAudioStreamRef.current) {
        const aTrack = localRawAudioStreamRef.current.getAudioTracks().find((t) => t.readyState === 'live');
        if (aTrack) {
          pc.addTrack(aTrack, localRawAudioStreamRef.current);
        }
      }

      // Pre-reserve audio transceiver if not present
      const transceivers = pc.getTransceivers();
      if (!transceivers.some((t) => t.receiver.track.kind === 'audio')) {
        try {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
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

      // Remote Track handler: binds audio track directly to the peer's persistent MediaStream
      pc.ontrack = (event) => {
        if (event.track.kind !== 'audio') return;
        const stream = remoteStream;
        const newTrack = event.track;

        // Clean up stale audio tracks
        stream.getAudioTracks().forEach((existingTrack) => {
          if (existingTrack.id !== newTrack.id) {
            stream.removeTrack(existingTrack);
          }
        });

        if (!stream.getAudioTracks().some((t) => t.id === newTrack.id)) {
          stream.addTrack(newTrack);
        }

        // Fast audio playback binding
        const audioEl = remoteAudioRefs.current[peerId];
        if (audioEl) {
          if (audioEl.srcObject !== stream) {
            audioEl.srcObject = stream;
          }
          audioEl.volume = 1.0;
          audioEl.muted = false;
          audioEl.play().catch((err) => {
            console.warn('[LiveMedia] Remote audio autoplay blocked:', err);
            setAutoplayBlocked(true);
          });
        }

        setPeers((prev) => {
          const existing = prev[peerId] || {
            userId: peerId,
            userName: 'Collaborator',
            userRole: 'CANDIDATE',
            isMicOn: true,
            isSpeaking: false
          };
          return {
            ...prev,
            [peerId]: {
              ...existing,
              stream
            }
          };
        });
      };

      peerConnectionsRef.current[peerId] = pc;
      return pc;
    },
    [getOrCreateRemoteStream, sendMessage]
  );

  // Initiate WebRTC Offer (Controlled negotiation)
  const initiateOffer = useCallback(
    async (peerId: string) => {
      if (!peerId || String(peerId) === String(currentUserId)) return;
      try {
        const pc = getOrCreatePeerConnection(peerId);
        if (pc.signalingState !== 'stable') return;

        makingOfferRef.current[peerId] = true;

        // Ensure active local audio track is attached to sender
        if (localRawAudioStreamRef.current) {
          const aTrack = localRawAudioStreamRef.current.getAudioTracks().find((t) => t.readyState === 'live');
          if (aTrack) {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'audio' || (s as any).kind === 'audio');
            if (sender) {
              await sender.replaceTrack(aTrack).catch(() => {});
            }
          }
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

  // Quick Voice Reconnect Trigger
  const reconnectVoice = useCallback(() => {
    setIsReconnecting(true);

    sendMessage('MEDIA_STATUS_UPDATE', {
      isMicOn: isMicOnRef.current,
      isSpeaking: isLocalSpeakingRef.current,
      resyncRequested: true
    });

    Object.keys(peersRef.current).forEach((peerId) => {
      initiateOffer(peerId);
    });

    setTimeout(() => {
      setIsReconnecting(false);
    }, 800);
  }, [initiateOffer, sendMessage]);

  // Toggle Microphone
  const toggleMic = async () => {
    const nextState = !isMicOn;
    setMediaError(null);

    try {
      if (nextState) {
        // High quality microphone constraints with browser-native echo cancellation and noise suppression
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: 1,
          sampleRate: { ideal: 48000 }
        };

        const micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        localRawAudioStreamRef.current = micStream;

        const audioTrack = micStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;
          audioTrack.onended = () => {
            if (localRawAudioStreamRef.current) {
              localRawAudioStreamRef.current.getAudioTracks().forEach((t) => t.stop());
              localRawAudioStreamRef.current = null;
            }
            cleanupSpeechDetector();
            Object.values(peerConnectionsRef.current).forEach((pc) => {
              if (!pc || pc.connectionState === 'closed') return;
              const sender = pc.getSenders().find((s) => s.track?.kind === 'audio' || (s as any).kind === 'audio');
              if (sender) {
                sender.replaceTrack(null).catch(() => {});
              }
            });
            setIsMicOn(false);
            sendMessage('MEDIA_STATUS_UPDATE', {
              isMicOn: false,
              isSpeaking: false
            });
          };
        }

        // Setup speech visual level detector
        setupSpeechDetector(micStream);

        // Attach audio track to all known peers
        const peerIds = new Set([
          ...Object.keys(peersRef.current),
          ...initialParticipants.map((p) => p.userId).filter((id) => id && String(id) !== String(currentUserId))
        ]);

        for (const peerId of peerIds) {
          const pc = getOrCreatePeerConnection(peerId);
          if (!pc || pc.connectionState === 'closed') continue;
          const sender = pc.getSenders().find((s) => s.track?.kind === 'audio' || (s as any).kind === 'audio');
          if (sender) {
            await sender.replaceTrack(audioTrack).catch(() => {});
          } else {
            pc.addTrack(audioTrack, micStream);
            initiateOffer(peerId);
          }
        }

        setIsMicOn(true);
      } else {
        // Stop audio tracks and mute
        if (localRawAudioStreamRef.current) {
          localRawAudioStreamRef.current.getAudioTracks().forEach((t) => t.stop());
          localRawAudioStreamRef.current = null;
        }

        cleanupSpeechDetector();

        // Mute track on peer connections
        for (const pc of Object.values(peerConnectionsRef.current)) {
          if (!pc || pc.connectionState === 'closed') continue;
          const sender = pc.getSenders().find((s) => s.track?.kind === 'audio' || (s as any).kind === 'audio');
          if (sender) {
            sender.replaceTrack(null).catch(() => {});
          }
        }

        setIsMicOn(false);
      }

      sendMessage('MEDIA_STATUS_UPDATE', {
        isMicOn: nextState,
        isSpeaking: false
      });
    } catch (err: any) {
      console.error('[LiveMedia] Mic access error:', err);
      setMediaError(err.name === 'NotAllowedError' ? 'Microphone permission blocked.' : 'Microphone unavailable.');
      setIsMicOn(false);
    }
  };

  // Central Socket Message Dispatcher
  const handleSocketMessage = useCallback(
    async (message: any) => {
      if (!message) return;
      const { type, payload } = message;

      switch (type) {
        case 'SESSION_STATE': {
          const participants = payload?.participants || [];
          setPeers((prev) => {
            const next = { ...prev };
            participants.forEach((p: any) => {
              const pid = p.userId;
              if (pid && String(pid) !== String(currentUserId)) {
                if (!next[pid]) {
                  next[pid] = {
                    userId: pid,
                    userName: p.name || 'Collaborator',
                    userRole: p.role || 'CANDIDATE',
                    avatarUrl: p.avatarUrl,
                    isMicOn: false,
                    isSpeaking: false,
                    stream: remoteStreamsRef.current[pid]
                  };
                } else if (p.avatarUrl) {
                  next[pid].avatarUrl = p.avatarUrl;
                }
              }
            });
            return next;
          });

          // Connect to any active participants: only initiate offer if currentUserId < pid (perfect negotiation)
          participants.forEach((p: any) => {
            const pid = p.userId;
            if (pid && String(pid) !== String(currentUserId)) {
              getOrCreatePeerConnection(pid);
              if (currentUserId && currentUserId.localeCompare(pid) < 0) {
                initiateOffer(pid);
              }
            }
          });
          break;
        }

        case 'USER_JOINED': {
          const joinedUserId = payload?.userId;
          if (joinedUserId && String(joinedUserId) !== String(currentUserId)) {
            setPeers((prev) => ({
              ...prev,
              [joinedUserId]: {
                userId: joinedUserId,
                userName: payload.name || 'Collaborator',
                userRole: payload.role || 'CANDIDATE',
                avatarUrl: payload.avatarUrl,
                isMicOn: false,
                isSpeaking: false,
                stream: remoteStreamsRef.current[joinedUserId]
              }
            }));

            // Announce current mic status to newcomer
            sendMessage('MEDIA_STATUS_UPDATE', {
              isMicOn: isMicOnRef.current,
              isSpeaking: isLocalSpeakingRef.current
            });

            getOrCreatePeerConnection(joinedUserId);
            if (currentUserId && currentUserId.localeCompare(joinedUserId) < 0) {
              initiateOffer(joinedUserId);
            }
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
            if (remoteStreamsRef.current[leftUserId]) {
              remoteStreamsRef.current[leftUserId].getTracks().forEach((t) => t.stop());
              delete remoteStreamsRef.current[leftUserId];
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
          if (peerId && String(peerId) !== String(currentUserId)) {
            setPeers((prev) => {
              const existing = prev[peerId] || {
                userId: peerId,
                userName: payload.userName || 'Peer',
                userRole: payload.userRole || 'CANDIDATE',
                avatarUrl: payload.avatarUrl,
                isMicOn: false,
                isSpeaking: false,
                stream: remoteStreamsRef.current[peerId]
              };
              return {
                ...prev,
                [peerId]: {
                  ...existing,
                  userName: payload.userName || existing.userName,
                  userRole: payload.userRole || existing.userRole,
                  avatarUrl: payload.avatarUrl || existing.avatarUrl,
                  isMicOn: payload.isMicOn !== undefined ? !!payload.isMicOn : existing.isMicOn,
                  isSpeaking: payload.isSpeaking !== undefined ? !!payload.isSpeaking : existing.isSpeaking,
                  stream: existing.stream || remoteStreamsRef.current[peerId]
                }
              };
            });

            if (payload.resyncRequested) {
              initiateOffer(peerId);
            }
          }
          break;
        }

        case 'WEBRTC_OFFER': {
          const { fromUserId, targetUserId, offer } = payload || {};
          if (targetUserId && String(targetUserId) !== String(currentUserId)) break;
          if (fromUserId && String(fromUserId) !== String(currentUserId) && offer) {
            const pc = getOrCreatePeerConnection(fromUserId);
            const isPolite = currentUserId.localeCompare(fromUserId) > 0;
            const offerCollision = makingOfferRef.current[fromUserId] || pc.signalingState !== 'stable';

            if (offerCollision) {
              if (!isPolite) {
                return;
              }
              try {
                await pc.setLocalDescription({ type: 'rollback' });
              } catch (e) {
                console.warn('[LiveMedia] Rollback error:', e);
              }
            }

            try {
              await pc.setRemoteDescription(new RTCSessionDescription(offer));

              // Drain queued ICE candidates
              const pending = pendingCandidatesRef.current[fromUserId] || [];
              pendingCandidatesRef.current[fromUserId] = [];
              for (const c of pending) {
                await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
              }

              // Re-attach active local audio track if mic is on
              if (localRawAudioStreamRef.current) {
                const aTrack = localRawAudioStreamRef.current.getAudioTracks().find((t) => t.readyState === 'live');
                if (aTrack) {
                  const sender = pc.getSenders().find((s) => s.track?.kind === 'audio' || (s as any).kind === 'audio');
                  if (sender) {
                    await sender.replaceTrack(aTrack).catch(() => {});
                  }
                }
              }

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              sendMessage('WEBRTC_ANSWER', {
                targetUserId: fromUserId,
                answer
              });
            } catch (err) {
              console.warn('[LiveMedia] WebRTC Answer error:', err);
            }
          }
          break;
        }

        case 'WEBRTC_ANSWER': {
          const { fromUserId, targetUserId, answer } = payload || {};
          if (targetUserId && String(targetUserId) !== String(currentUserId)) break;
          if (fromUserId && String(fromUserId) !== String(currentUserId) && answer) {
            const pc = peerConnectionsRef.current[fromUserId];
            if (pc && pc.signalingState === 'have-local-offer') {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));

                const pending = pendingCandidatesRef.current[fromUserId] || [];
                pendingCandidatesRef.current[fromUserId] = [];
                for (const c of pending) {
                  await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
                }
              } catch (err) {
                console.warn('[LiveMedia] SetRemoteDescription error:', err);
              }
            }
          }
          break;
        }

        case 'WEBRTC_ICE_CANDIDATE': {
          const { fromUserId, targetUserId, candidate } = payload || {};
          if (targetUserId && String(targetUserId) !== String(currentUserId)) break;
          if (fromUserId && String(fromUserId) !== String(currentUserId) && candidate) {
            const pc = peerConnectionsRef.current[fromUserId];
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
              pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
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
    },
    [currentUserId, getOrCreatePeerConnection, initiateOffer, sendMessage]
  );

  // Subscribe to real-time socket events via direct listener
  useEffect(() => {
    if (addSocketListener) {
      return addSocketListener((msg) => {
        handleSocketMessage(msg);
      });
    }
  }, [addSocketListener, handleSocketMessage]);

  // Fallback support for prop updates
  useEffect(() => {
    if (lastSocketMessage && !addSocketListener) {
      handleSocketMessage(lastSocketMessage);
    }
  }, [lastSocketMessage, addSocketListener, handleSocketMessage]);

  // Handle participant updates from parent props
  useEffect(() => {
    if (!initialParticipants || initialParticipants.length === 0) return;
    initialParticipants.forEach((p) => {
      if (p.userId && String(p.userId) !== String(currentUserId)) {
        setPeers((prev) => {
          if (prev[p.userId]) return prev;
          return {
            ...prev,
            [p.userId]: {
              userId: p.userId,
              userName: p.name || 'Collaborator',
              userRole: p.role || 'CANDIDATE',
              avatarUrl: p.avatarUrl,
              isMicOn: false,
              isSpeaking: false,
              stream: remoteStreamsRef.current[p.userId]
            }
          };
        });

        getOrCreatePeerConnection(p.userId);
        if (currentUserId && currentUserId.localeCompare(p.userId) < 0) {
          initiateOffer(p.userId);
        }
      }
    });
  }, [initialParticipants, currentUserId, getOrCreatePeerConnection, initiateOffer]);

  // Initial mount: broadcast status and connect to initial participants
  useEffect(() => {
    sendMessage('MEDIA_STATUS_UPDATE', {
      isMicOn: false,
      isSpeaking: false
    });

    return () => {
      cleanupSpeechDetector();
      if (localRawAudioStreamRef.current) {
        localRawAudioStreamRef.current.getTracks().forEach((track) => track.stop());
        localRawAudioStreamRef.current = null;
      }
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        try {
          pc.close();
        } catch {}
      });
      peerConnectionsRef.current = {};
      Object.values(remoteStreamsRef.current).forEach((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });
      remoteStreamsRef.current = {};
    };
  }, []);

  const activePeerList = Object.values(peers);

  // If in docked mini bar mode (keep audio element active in DOM so voice call never terminates)
  if (isDocked) {
    return (
      <div className="flex items-center justify-between gap-2 p-2 px-3 rounded-xl bg-slate-900/90 dark:bg-white/[0.04] border border-slate-700/60 dark:border-white/10 text-white backdrop-blur-md shadow-lg text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMicOn ? 'bg-emerald-400 opacity-75' : 'bg-indigo-400 opacity-40'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isMicOn ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
          </span>
          <span className="font-bold text-[11px] text-slate-200">Voice Call</span>
          {isMicOn && (
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono flex items-center gap-0.5">
              Mic Active
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
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

          {/* Expand Call */}
          {onExpand && (
            <button
              onClick={onExpand}
              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
              title="Expand Voice Chat"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Voice</span>
            </button>
          )}
        </div>

        {/* Hidden persistent remote audio elements so audio plays uninterrupted */}
        <div className="sr-only">
          {activePeerList.map((peer) => {
            const stream = peer.stream || remoteStreamsRef.current[peer.userId];
            return (
              <audio
                key={peer.userId}
                ref={(el) => {
                  remoteAudioRefs.current[peer.userId] = el;
                  if (el && stream && el.srcObject !== stream) {
                    el.srcObject = stream;
                    el.volume = 1.0;
                    el.muted = false;
                    el.play().catch(() => setAutoplayBlocked(true));
                  }
                }}
                autoPlay
                playsInline
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`transition-all duration-300 ${isMinimized ? 'w-auto' : 'w-full'} shrink-0`}>
      {/* Container Card with Theme Styling */}
      <div
        className={`rounded-2xl border ${themeConfig.border} ${themeConfig.bgCard} p-3.5 shadow-lg ${
          themeConfig.isDark ? 'bg-slate-900/95' : 'bg-white/95'
        } backdrop-blur-md transition-all duration-200 relative`}
      >
        {/* Header Ribbon */}
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/50 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMicOn ? 'bg-emerald-400 opacity-75' : 'bg-indigo-400 opacity-40'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isMicOn ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
            </span>
            <span className="text-xs font-bold font-heading tracking-tight flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
              <span>Voice Session</span>
              {connectionStatus === 'connected' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-0.5">
                  <Signal className="w-2.5 h-2.5" /> P2P Voice
                </span>
              )}
              {isLocalSpeaking && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 animate-pulse font-semibold">
                  <Volume2 className="w-2.5 h-2.5" /> Speaking
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Quick Voice Reconnect */}
            <button
              onClick={reconnectVoice}
              disabled={isReconnecting}
              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
              title="Reconnect Voice (Instant WebRTC Refresh)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin text-indigo-500' : ''}`} />
            </button>

            {/* Speaker Sound Check Button */}
            <button
              onClick={playSpeakerTestChime}
              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
              title="Test Speaker Output (Play Test Chime)"
            >
              <Headphones className="w-3.5 h-3.5" />
            </button>

            {/* Minimize / Expand */}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
              title={isMinimized ? 'Expand Media' : 'Minimize Media'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Autoplay Blocked Banner */}
        {autoplayBlocked && (
          <div className="mb-2.5 p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-[11px] flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1.5">
              <VolumeX className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Audio blocked by browser policy.</span>
            </div>
            <button
              onClick={handleEnableSound}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] cursor-pointer"
            >
              Enable Audio
            </button>
          </div>
        )}

        {/* Media Error Message */}
        {mediaError && (
          <div className="mb-2.5 p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{mediaError} Check microphone permissions.</span>
          </div>
        )}

        {/* Expanded View: Voice Participants Grid */}
        {!isMinimized && (
          <div className="space-y-3">
            {/* Grid of voice cards: You + Remote Collaborator */}
            <div className={`grid ${activePeerList.length > 0 ? 'grid-cols-2 gap-2.5' : 'grid-cols-1'} items-stretch`}>
              {/* Local Participant Voice Tile */}
              <div
                className={`relative p-3.5 rounded-xl border ${
                  isLocalSpeaking
                    ? 'border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]'
                } flex flex-col items-center justify-center transition-all duration-200 shadow-xs min-h-[110px]`}
              >
                <div className="relative mb-2">
                  <UserAvatar
                    name={currentUserName}
                    avatarUrl={currentUserAvatarUrl}
                    size="md"
                    isOnline={true}
                  />
                  {isLocalSpeaking && (
                    <span className="absolute -inset-1 rounded-full border-2 border-emerald-400 animate-ping opacity-75" />
                  )}
                </div>

                <div className="text-center w-full">
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate px-1">
                    You ({currentUserRole})
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    {isMicOn ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <Mic className="w-2.5 h-2.5" /> Mic Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20">
                        <MicOff className="w-2.5 h-2.5" /> Muted
                      </span>
                    )}

                    {isLocalSpeaking && (
                      <div className="flex items-end gap-0.5 h-3 px-1 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50">
                        <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-2" />
                        <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce h-3" />
                        <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-1.5" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Remote Peer Voice Tiles */}
              {activePeerList.map((peer) => {
                const stream = peer.stream || remoteStreamsRef.current[peer.userId];
                return (
                  <div
                    key={peer.userId}
                    className={`relative p-3.5 rounded-xl border ${
                      peer.isSpeaking
                        ? 'border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]'
                    } flex flex-col items-center justify-center transition-all duration-200 shadow-xs min-h-[110px]`}
                  >
                    {/* Dedicated Remote Audio Element (Unmuted for crisp live voice) */}
                    <audio
                      ref={(el) => {
                        remoteAudioRefs.current[peer.userId] = el;
                        if (el && stream && el.srcObject !== stream) {
                          el.srcObject = stream;
                        }
                        if (el) {
                          el.volume = 1.0;
                          el.muted = false;
                          el.play().catch(() => setAutoplayBlocked(true));
                        }
                      }}
                      autoPlay
                      playsInline
                      className="sr-only"
                    />

                    <div className="relative mb-2">
                      <UserAvatar
                        name={peer.userName}
                        avatarUrl={peer.avatarUrl}
                        size="md"
                        isOnline={true}
                      />
                      {peer.isSpeaking && (
                        <span className="absolute -inset-1 rounded-full border-2 border-emerald-400 animate-ping opacity-75" />
                      )}
                    </div>

                    <div className="text-center w-full">
                      <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate px-1">
                        {peer.userName}
                      </div>
                      <div className="mt-1 flex items-center justify-center gap-1.5">
                        {peer.isMicOn ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <Mic className="w-2.5 h-2.5" /> Mic Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                            <MicOff className="w-2.5 h-2.5 text-rose-400" /> Muted
                          </span>
                        )}

                        {peer.isSpeaking && (
                          <div className="flex items-end gap-0.5 h-3 px-1 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50">
                            <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-2" />
                            <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce h-3" />
                            <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-1.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Waiting Notice if Solo */}
            {activePeerList.length === 0 && (
              <div className="text-center py-2.5 px-3 rounded-xl bg-slate-100/50 dark:bg-white/[0.02] border border-dashed border-slate-300 dark:border-white/10">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Waiting for collaborator to join the session...
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Your mic connects automatically upon peer arrival.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Controls Toolbar: Microphone Button Only */}
        <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-white/10">
          <button
            onClick={toggleMic}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
              isMicOn
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25 ring-2 ring-emerald-500/30'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/25'
            }`}
            title={isMicOn ? 'Click to Mute Microphone' : 'Click to Unmute Microphone'}
          >
            {isMicOn ? (
              <>
                <Mic className="w-4 h-4 animate-pulse text-white" />
                <span className="text-[12px]">Mic is ON (Click to Mute)</span>
              </>
            ) : (
              <>
                <MicOff className="w-4 h-4 text-rose-500" />
                <span className="text-[12px]">Mic is OFF (Click to Speak)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
