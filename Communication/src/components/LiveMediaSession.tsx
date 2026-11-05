import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  RemoteParticipant,
  RemoteTrackPublication,
  LocalTrackPublication,
  Participant
} from 'livekit-client';
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
  Signal,
  RefreshCw,
  Radio
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';
import { UserAvatar } from './UserAvatar.js';
import { sessionService } from '../services/api.js';

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
  sendMessage?: (type: string, payload: any) => void;
  lastSocketMessage?: any;
  addSocketListener?: (listener: (msg: any) => void) => () => void;
  initialParticipants?: ParticipantInfo[];
  isDocked?: boolean;
  onExpand?: () => void;
}

interface RemotePeerState {
  identity: string;
  name: string;
  role: string;
  avatarUrl?: string;
  isMicOn: boolean;
  isCamOn: boolean;
  isSpeaking: boolean;
  videoTrack?: Track;
  audioTrack?: Track;
}

export const LiveMediaSession: React.FC<LiveMediaSessionProps> = ({
  sessionId,
  currentUserId,
  currentUserName,
  currentUserRole,
  currentUserAvatarUrl,
  addSocketListener,
  lastSocketMessage,
  initialParticipants = [],
  isDocked = false,
  onExpand
}) => {
  const { themeConfig } = useTheme();

  // Local Controls State
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Remote Peers State
  const [peers, setPeers] = useState<Record<string, RemotePeerState>>(() => {
    const initial: Record<string, RemotePeerState> = {};
    if (initialParticipants && initialParticipants.length > 0) {
      initialParticipants.forEach((p) => {
        if (p.userId && String(p.userId) !== String(currentUserId)) {
          initial[p.userId] = {
            identity: p.userId,
            name: p.name || 'Collaborator',
            role: p.role || 'CANDIDATE',
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

  // DOM and LiveKit Refs
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const attachedAudioElements = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Attach remote audio track immediately to DOM element
  const attachAudioTrack = useCallback((track: Track, participantIdentity: string) => {
    if (track.kind !== Track.Kind.Audio) return;
    const trackKey = `${participantIdentity}_${track.sid || 'audio'}`;
    let audioEl = attachedAudioElements.current.get(trackKey);

    if (!audioEl) {
      audioEl = (track as any).attach() as HTMLAudioElement;
      audioEl.id = `livekit-audio-${trackKey}`;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      attachedAudioElements.current.set(trackKey, audioEl);
    } else {
      (track as any).attach(audioEl);
    }

    audioEl.volume = 1.0;
    audioEl.muted = false;
    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[LiveKit] Autoplay prevented, will resume on interaction:', err);
        setAutoplayBlocked(true);
      });
    }
  }, []);

  const detachAudioTrack = useCallback((track: Track, participantIdentity: string) => {
    const trackKey = `${participantIdentity}_${track.sid || 'audio'}`;
    const audioEl = attachedAudioElements.current.get(trackKey);
    if (audioEl) {
      track.detach(audioEl);
      audioEl.remove();
      attachedAudioElements.current.delete(trackKey);
    } else {
      track.detach();
    }
  }, []);

  // Unlock browser audio globally
  const unlockAudio = useCallback(async () => {
    if (roomRef.current) {
      try {
        await roomRef.current.startAudio();
      } catch {}
    }
    attachedAudioElements.current.forEach((el) => {
      el.muted = false;
      el.volume = 1.0;
      el.play().catch(() => {});
    });
    setAutoplayBlocked(false);
  }, []);

  // Listen for interaction events to unlock audio continuously
  useEffect(() => {
    const onUserInteraction = () => {
      unlockAudio();
    };

    window.addEventListener('click', onUserInteraction);
    window.addEventListener('keydown', onUserInteraction);
    window.addEventListener('touchstart', onUserInteraction);
    window.addEventListener('pointerdown', onUserInteraction);

    return () => {
      window.removeEventListener('click', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
      window.removeEventListener('touchstart', onUserInteraction);
      window.removeEventListener('pointerdown', onUserInteraction);
    };
  }, [unlockAudio]);

  // Parse metadata helper
  const parseParticipantMeta = (metaStr?: string): { role: string; avatarUrl?: string } => {
    try {
      if (!metaStr) return { role: 'CANDIDATE' };
      const parsed = JSON.parse(metaStr);
      return { role: parsed.role || 'CANDIDATE', avatarUrl: parsed.avatarUrl };
    } catch {
      return { role: 'CANDIDATE' };
    }
  };

  // Connect to LiveKit Room
  const connectToLiveKit = useCallback(async () => {
    if (!sessionId) return;

    try {
      setConnectionStatus('connecting');
      setErrorMessage(null);

      // Disconnect existing room session if any
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }

      // 1. Fetch access token and wsUrl from backend
      const res = await sessionService.getLiveKitToken(sessionId);
      const { token, wsUrl } = res || {};

      if (!token) {
        throw new Error('Failed to obtain LiveKit room access token.');
      }

      // 2. Initialize LiveKit Room instance with optimal low-latency audio defaults
      const room = new Room({
        adaptiveStream: false,
        dynacast: false,
        stopLocalTrackOnUnpublish: false,
        publishDefaults: {
          stopMicTrackOnMute: false, // Instant unmute with 0ms OS hardware delay
          audioPreset: { maxBitrate: 48000 }
        },
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        },
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution
        }
      });

      roomRef.current = room;

      // Event: Participant connected
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        const meta = parseParticipantMeta(participant.metadata);
        setPeers((prev) => ({
          ...prev,
          [participant.identity]: {
            identity: participant.identity,
            name: participant.name || 'Collaborator',
            role: meta.role,
            avatarUrl: meta.avatarUrl,
            isMicOn: participant.isMicrophoneEnabled,
            isCamOn: participant.isCameraEnabled,
            isSpeaking: participant.isSpeaking
          }
        }));
      });

      // Event: Participant disconnected
      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        setPeers((prev) => {
          const next = { ...prev };
          delete next[participant.identity];
          return next;
        });
      });

      // Event: Track subscribed (Remote camera or microphone received)
      room.on(
        RoomEvent.TrackSubscribed,
        (track: Track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          const meta = parseParticipantMeta(participant.metadata);

          if (track.kind === Track.Kind.Video) {
            setPeers((prev) => ({
              ...prev,
              [participant.identity]: {
                ...(prev[participant.identity] || {
                  identity: participant.identity,
                  name: participant.name || 'Collaborator',
                  role: meta.role,
                  avatarUrl: meta.avatarUrl,
                  isMicOn: participant.isMicrophoneEnabled,
                  isSpeaking: participant.isSpeaking
                }),
                videoTrack: track,
                isCamOn: true
              }
            }));

            // Attach to remote video element
            setTimeout(() => {
              const videoEl = remoteVideoRefs.current[participant.identity];
              if (videoEl) {
                track.attach(videoEl);
                videoEl.play().catch(() => {});
              }
            }, 10);
          } else if (track.kind === Track.Kind.Audio) {
            attachAudioTrack(track, participant.identity);

            setPeers((prev) => ({
              ...prev,
              [participant.identity]: {
                ...(prev[participant.identity] || {
                  identity: participant.identity,
                  name: participant.name || 'Collaborator',
                  role: meta.role,
                  avatarUrl: meta.avatarUrl,
                  isCamOn: participant.isCameraEnabled,
                  isSpeaking: participant.isSpeaking
                }),
                audioTrack: track,
                isMicOn: true
              }
            }));
          }
        }
      );

      // Event: Track unsubscribed
      room.on(
        RoomEvent.TrackUnsubscribed,
        (track: Track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Video) {
            track.detach();
            setPeers((prev) => {
              if (!prev[participant.identity]) return prev;
              return {
                ...prev,
                [participant.identity]: {
                  ...prev[participant.identity],
                  videoTrack: undefined,
                  isCamOn: false
                }
              };
            });
          } else if (track.kind === Track.Kind.Audio) {
            detachAudioTrack(track, participant.identity);
            setPeers((prev) => {
              if (!prev[participant.identity]) return prev;
              return {
                ...prev,
                [participant.identity]: {
                  ...prev[participant.identity],
                  audioTrack: undefined,
                  isMicOn: false
                }
              };
            });
          }
        }
      );

      // Event: Track muted / unmuted (Camera or mic state changes)
      room.on(RoomEvent.TrackMuted, (publication, participant) => {
        if (participant === room.localParticipant) {
          if (publication.kind === Track.Kind.Audio) setIsMicOn(false);
          if (publication.kind === Track.Kind.Video) setIsCamOn(false);
        } else {
          setPeers((prev) => {
            if (!prev[participant.identity]) return prev;
            return {
              ...prev,
              [participant.identity]: {
                ...prev[participant.identity],
                isCamOn: publication.kind === Track.Kind.Video ? false : prev[participant.identity].isCamOn,
                isMicOn: publication.kind === Track.Kind.Audio ? false : prev[participant.identity].isMicOn
              }
            };
          });
        }
      });

      room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
        if (participant === room.localParticipant) {
          if (publication.kind === Track.Kind.Audio) setIsMicOn(true);
          if (publication.kind === Track.Kind.Video) setIsCamOn(true);
        } else {
          if (publication.kind === Track.Kind.Audio && publication.track) {
            attachAudioTrack(publication.track, participant.identity);
          }
          setPeers((prev) => {
            if (!prev[participant.identity]) return prev;
            return {
              ...prev,
              [participant.identity]: {
                ...prev[participant.identity],
                isCamOn: publication.kind === Track.Kind.Video ? true : prev[participant.identity].isCamOn,
                isMicOn: publication.kind === Track.Kind.Audio ? true : prev[participant.identity].isMicOn
              }
            };
          });
        }
      });

      // Event: Active speakers updated
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const localSpeaking = speakers.some((s) => s === room.localParticipant);
        setIsLocalSpeaking(localSpeaking);

        setPeers((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((id) => {
            next[id] = {
              ...next[id],
              isSpeaking: speakers.some((s) => s.identity === id)
            };
          });
          return next;
        });
      });

      // Connect to LiveKit room
      await room.connect(wsUrl || 'ws://127.0.0.1:7880', token);
      setConnectionStatus('connected');

      // Populate and connect existing remote participants in room
      room.remoteParticipants.forEach((participant) => {
        const meta = parseParticipantMeta(participant.metadata);
        let existingAudioTrack: Track | undefined;
        let existingVideoTrack: Track | undefined;

        participant.trackPublications.forEach((pub) => {
          if (pub.track && pub.isSubscribed) {
            if (pub.kind === Track.Kind.Audio) {
              existingAudioTrack = pub.track;
              attachAudioTrack(pub.track, participant.identity);
            } else if (pub.kind === Track.Kind.Video) {
              existingVideoTrack = pub.track;
            }
          }
        });

        setPeers((prev) => ({
          ...prev,
          [participant.identity]: {
            identity: participant.identity,
            name: participant.name || 'Collaborator',
            role: meta.role,
            avatarUrl: meta.avatarUrl,
            isMicOn: participant.isMicrophoneEnabled || !!existingAudioTrack,
            isCamOn: participant.isCameraEnabled || !!existingVideoTrack,
            isSpeaking: participant.isSpeaking,
            audioTrack: existingAudioTrack,
            videoTrack: existingVideoTrack
          }
        }));

        if (existingVideoTrack) {
          setTimeout(() => {
            const videoEl = remoteVideoRefs.current[participant.identity];
            if (videoEl && existingVideoTrack) {
              existingVideoTrack.attach(videoEl);
              videoEl.play().catch(() => {});
            }
          }, 50);
        }
      });
    } catch (err: any) {
      console.warn('[LiveKit] Connection error:', err);
      setConnectionStatus('error');
      setErrorMessage(err.message || 'Failed to connect to LiveKit room.');
    }
  }, [sessionId, currentUserId, attachAudioTrack, detachAudioTrack]);

  // Initial connect and cleanup
  useEffect(() => {
    connectToLiveKit();

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      attachedAudioElements.current.forEach((el) => {
        el.remove();
      });
      attachedAudioElements.current.clear();
    };
  }, [connectToLiveKit]);

  // Sync remote tracks helper for WebSocket updates
  const syncRemoteTracks = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((pub) => {
        if (pub.track && pub.isSubscribed && pub.kind === Track.Kind.Audio) {
          attachAudioTrack(pub.track, participant.identity);
        }
      });
    });
  }, [attachAudioTrack]);

  // Re-sync on WebSocket events
  useEffect(() => {
    if (!addSocketListener) return;
    const unsubscribe = addSocketListener((msg: any) => {
      if (msg.type === 'USER_JOINED' || msg.type === 'USER_LEFT' || msg.type === 'SESSION_SYNC') {
        setTimeout(syncRemoteTracks, 300);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [addSocketListener, syncRemoteTracks]);

  useEffect(() => {
    if (lastSocketMessage && (lastSocketMessage.type === 'USER_JOINED' || lastSocketMessage.type === 'USER_PRESENCE_UPDATED')) {
      setTimeout(syncRemoteTracks, 300);
    }
  }, [lastSocketMessage, syncRemoteTracks]);

  // Re-sync initial participants if provided
  useEffect(() => {
    if (!initialParticipants || initialParticipants.length === 0) return;
    setPeers((prev) => {
      const next = { ...prev };
      initialParticipants.forEach((p) => {
        if (p.userId && String(p.userId) !== String(currentUserId)) {
          if (!next[p.userId]) {
            next[p.userId] = {
              identity: p.userId,
              name: p.name || 'Collaborator',
              role: p.role || 'CANDIDATE',
              avatarUrl: p.avatarUrl,
              isMicOn: false,
              isCamOn: false,
              isSpeaking: false
            };
          }
        }
      });
      return next;
    });
  }, [initialParticipants, currentUserId]);

  // Toggle Microphone via LiveKit
  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      unlockAudio();
      const nextState = !isMicOn;
      await room.localParticipant.setMicrophoneEnabled(nextState);
      setIsMicOn(nextState);
    } catch (err: any) {
      console.error('[LiveKit] Toggle mic error:', err);
      setErrorMessage(err.name === 'NotAllowedError' ? 'Microphone permission blocked.' : 'Microphone unavailable.');
    }
  };

  // Toggle Camera via LiveKit
  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      unlockAudio();
      const nextState = !isCamOn;
      await room.localParticipant.setCameraEnabled(nextState);
      setIsCamOn(nextState);

      // Attach or detach local video element
      if (nextState) {
        setTimeout(() => {
          const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
          if (camPub?.track && localVideoRef.current) {
            camPub.track.attach(localVideoRef.current);
            localVideoRef.current.play().catch(() => {});
          }
        }, 50);
      } else {
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (camPub?.track && localVideoRef.current) {
          camPub.track.detach(localVideoRef.current);
        }
      }
    } catch (err: any) {
      console.error('[LiveKit] Toggle cam error:', err);
      setErrorMessage(err.name === 'NotAllowedError' ? 'Camera permission blocked.' : 'Camera unavailable.');
    }
  };

  // Quick Reconnect utility
  const handleReconnect = async () => {
    setIsReconnecting(true);
    await connectToLiveKit();
    setTimeout(() => {
      setIsReconnecting(false);
    }, 600);
  };

  // Play Speaker Test Chime
  const playSpeakerTestChime = () => {
    try {
      unlockAudio();
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
    unlockAudio();
  };

  const activePeerList = Object.values(peers);

  // Docked Mini Mode
  if (isDocked) {
    return (
      <div className="flex items-center justify-between gap-2 p-2 px-3 rounded-xl bg-slate-900/90 dark:bg-white/[0.04] border border-slate-700/60 dark:border-white/10 text-white backdrop-blur-md shadow-lg text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMicOn || isCamOn ? 'bg-emerald-400 opacity-75' : 'bg-indigo-400 opacity-40'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isMicOn || isCamOn ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
          </span>
          <span className="font-bold text-[11px] text-slate-200">LiveKit Media</span>
          {connectionStatus === 'connected' && (
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono flex items-center gap-0.5">
              Live
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
              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
              title="Expand Live Video"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Media</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`transition-all duration-300 ${isMinimized ? 'w-auto' : 'w-full'} shrink-0`}>
      {/* Container Card */}
      <div
        className={`rounded-2xl border ${themeConfig.border} ${themeConfig.bgCard} p-3 shadow-lg ${
          themeConfig.isDark ? 'bg-slate-900/90' : 'bg-white/95'
        } backdrop-blur-md transition-all duration-200 relative`}
      >
        {/* Header Ribbon */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/50 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMicOn || isCamOn ? 'bg-emerald-400 opacity-75' : 'bg-indigo-400 opacity-40'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isMicOn || isCamOn ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
            </span>
            <span className="text-xs font-bold font-heading tracking-tight flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
              <span>LiveKit Video Call</span>
              {connectionStatus === 'connected' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-0.5">
                  <Signal className="w-2.5 h-2.5" /> Live
                </span>
              )}
              {connectionStatus === 'connecting' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono flex items-center gap-0.5">
                  Connecting...
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
            {/* Quick LiveKit Reconnect */}
            <button
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition cursor-pointer"
              title="Reconnect LiveKit Stream"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin text-indigo-500' : ''}`} />
            </button>

            {/* Speaker Sound Check Button */}
            <button
              onClick={playSpeakerTestChime}
              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition cursor-pointer"
              title="Test Speaker Output (Play Test Chime)"
            >
              <Headphones className="w-3.5 h-3.5" />
            </button>

            {/* Minimize / Expand */}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition cursor-pointer"
              title={isMinimized ? 'Expand Media' : 'Minimize Media'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Autoplay Blocked Banner */}
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

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-2 p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Expanded View: Video Feeds Grid */}
        {!isMinimized && (
          <div className="space-y-2.5">
            <div className={`grid ${activePeerList.length > 0 ? 'grid-cols-2 gap-2' : 'grid-cols-1'} items-center`}>
              {/* Local Participant Tile */}
              <div
                className={`relative aspect-video rounded-xl overflow-hidden border ${
                  isLocalSpeaking
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'border-slate-300/40 dark:border-white/10'
                } bg-slate-950 flex flex-col items-center justify-center transition-all duration-200 shadow-inner`}
              >
                {/* Local Video Element */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${isCamOn ? 'block' : 'hidden'}`}
                />

                {/* Local Avatar Placeholder */}
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

                {/* Badge: Name & Role */}
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/70 text-white backdrop-blur-xs">
                    You ({currentUserRole})
                  </span>
                </div>

                {/* Badges: Mic & Speaking Wave */}
                <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
                  {isLocalSpeaking && (
                    <div className="flex items-end gap-0.5 h-3 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50">
                      <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-2" />
                      <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce h-3" />
                      <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-1.5" />
                    </div>
                  )}

                  <span className={`p-1 rounded-md text-[10px] ${isMicOn ? 'bg-emerald-500/80 text-white' : 'bg-rose-500/80 text-white'}`}>
                    {isMicOn ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
                  </span>
                </div>
              </div>

              {/* Remote Peer Tiles */}
              {activePeerList.map((peer) => (
                <div
                  key={peer.identity}
                  className={`relative aspect-video rounded-xl overflow-hidden border ${
                    peer.isSpeaking
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'border-slate-300/40 dark:border-white/10'
                  } bg-slate-950 flex flex-col items-center justify-center transition-all duration-200 shadow-inner`}
                >
                  {/* Remote Video Element */}
                  <video
                    ref={(el) => {
                      remoteVideoRefs.current[peer.identity] = el;
                      if (el && peer.videoTrack) {
                        peer.videoTrack.attach(el);
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${peer.isCamOn && peer.videoTrack ? 'block' : 'hidden'}`}
                  />

                  {/* Remote Avatar Placeholder */}
                  {(!peer.isCamOn || !peer.videoTrack) && (
                    <div className="flex flex-col items-center justify-center p-2 text-center">
                      <UserAvatar
                        name={peer.name}
                        avatarUrl={peer.avatarUrl}
                        size="md"
                        isOnline={true}
                      />
                      <span className="text-[10px] text-slate-400 mt-1.5 font-medium flex items-center gap-1">
                        <span>{peer.name} (Camera Off)</span>
                      </span>
                    </div>
                  )}

                  {/* Top Badge: Name */}
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/70 text-white backdrop-blur-xs">
                      {peer.name} ({peer.role})
                    </span>
                  </div>

                  {/* Bottom Badges */}
                  <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
                    {peer.isSpeaking && (
                      <div className="flex items-end gap-0.5 h-3 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50">
                        <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-2" />
                        <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce h-3" />
                        <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-1.5" />
                      </div>
                    )}

                    <span className={`p-1 rounded-md text-[10px] ${peer.isMicOn ? 'bg-emerald-500/80 text-white' : 'bg-slate-700/80 text-white'}`}>
                      {peer.isMicOn ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5 text-rose-300" />}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Waiting Notice if Solo */}
            {activePeerList.length === 0 && (
              <div className="text-center py-2 px-3 rounded-xl bg-slate-100/50 dark:bg-white/[0.02] border border-dashed border-slate-300 dark:border-white/10">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Waiting for collaborator to join the session...
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Turn your camera or mic on anytime; LiveKit connects automatically upon arrival.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Controls Toolbar: Mic & Cam */}
        <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-white/10 flex items-center justify-between gap-2">
          {/* Mic Button */}
          <button
            onClick={toggleMic}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm ${
              isMicOn
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
            }`}
            title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
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
            title={isCamOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isCamOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-bold">{isCamOn ? 'Cam On' : 'Cam Off'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
