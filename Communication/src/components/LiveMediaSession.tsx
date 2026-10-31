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
  Signal,
  ShieldCheck,
  RefreshCw,
  Sparkles
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
  const [isNoiseCancellationOn, setIsNoiseCancellationOn] = useState(true);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [isSyncingCam, setIsSyncingCam] = useState(false);

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

  // DOM and Audio Pipeline Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const remoteAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  // Media & WebRTC Refs
  const localRawAudioStreamRef = useRef<MediaStream | null>(null);
  const localProcessedAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const localVideoStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const makingOfferRef = useRef<Record<string, boolean>>({});

  // Web Audio DSP Noise Filter Nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const rawSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const highPassFilterRef = useRef<BiquadFilterNode | null>(null);
  const lowPassFilterRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const noiseGateGainRef = useRef<GainNode | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);

  // State mirror refs for event callbacks
  const isMicOnRef = useRef(isMicOn);
  isMicOnRef.current = isMicOn;
  const isCamOnRef = useRef(isCamOn);
  isCamOnRef.current = isCamOn;
  const isNoiseCancellationOnRef = useRef(isNoiseCancellationOn);
  isNoiseCancellationOnRef.current = isNoiseCancellationOn;
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
      Object.values(remoteVideoRefs.current).forEach((el) => {
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

  // Sync active local video stream to local element whenever isCamOn or localVideoRef changes
  useEffect(() => {
    if (isCamOn && localVideoStreamRef.current && localVideoRef.current) {
      if (localVideoRef.current.srcObject !== localVideoStreamRef.current) {
        localVideoRef.current.srcObject = localVideoStreamRef.current;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [isCamOn]);

  // Sync remote streams to remote video and audio elements on peers state change
  useEffect(() => {
    Object.entries(peers).forEach(([peerId, peer]) => {
      if (peer.stream) {
        const videoEl = remoteVideoRefs.current[peerId];
        if (videoEl && videoEl.srcObject !== peer.stream) {
          videoEl.srcObject = peer.stream;
          videoEl.play().catch(() => {});
        }
        const audioEl = remoteAudioRefs.current[peerId];
        if (audioEl && audioEl.srcObject !== peer.stream) {
          audioEl.srcObject = peer.stream;
          audioEl.volume = 1.0;
          audioEl.muted = false;
          audioEl.play().catch(() => setAutoplayBlocked(true));
        }
      }
    });
  }, [peers]);

  // Web Audio DSP Pipeline: High-pass + Low-pass + Compressor + Adaptive Noise Gate
  const setupNoiseCancelledAudioPipeline = (rawMicStream: MediaStream): MediaStreamTrack => {
    cleanupAudioPipeline();

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      // Fallback: return raw mic track if Web Audio API is unavailable
      return rawMicStream.getAudioTracks()[0];
    }

    const audioCtx = new AudioCtx();
    audioContextRef.current = audioCtx;

    // 1. Raw Microphone Source
    const source = audioCtx.createMediaStreamSource(rawMicStream);
    rawSourceNodeRef.current = source;

    // 2. High-pass filter at 85Hz: eliminates table vibrations, PC fan hum, and air conditioner drone
    const highPass = audioCtx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.setValueAtTime(85, audioCtx.currentTime);
    highPass.Q.setValueAtTime(0.7, audioCtx.currentTime);
    highPassFilterRef.current = highPass;

    // 3. Low-pass filter at 8000Hz: eliminates electronic coil whine, keyboard clicks, and high-pitch hiss
    const lowPass = audioCtx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.setValueAtTime(8000, audioCtx.currentTime);
    lowPass.Q.setValueAtTime(0.7, audioCtx.currentTime);
    lowPassFilterRef.current = lowPass;

    // 4. Dynamics Compressor: levels speech dynamics, prevents loud harsh peaks, boosts soft whisper
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-28, audioCtx.currentTime);
    compressor.knee.setValueAtTime(25, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(8, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.25, audioCtx.currentTime);
    compressorRef.current = compressor;

    // 5. Adaptive Noise Gate Gain: silences ambient room noise when user is not speaking
    const noiseGateGain = audioCtx.createGain();
    noiseGateGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
    noiseGateGainRef.current = noiseGateGain;

    // 6. Analyser for speech detection and noise gating
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // 7. Destination: output processed clean stream
    const destination = audioCtx.createMediaStreamDestination();
    audioDestinationRef.current = destination;

    // Connect DSP chain:
    // Raw -> HighPass -> LowPass -> Compressor -> NoiseGateGain -> Destination & Analyser
    source.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(compressor);
    compressor.connect(noiseGateGain);
    noiseGateGain.connect(destination);

    // Also connect to analyser to monitor voice levels
    compressor.connect(analyser);

    // Run active noise gate loop
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let speakingFrames = 0;

    const processAudioLevels = () => {
      if (!analyserRef.current || !audioContextRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const averageVolume = sum / bufferLength;

      // Threshold: voice is typically > 18, ambient floor is ~5-15
      const isAboveNoiseFloor = averageVolume > 16;
      if (isAboveNoiseFloor && isMicOnRef.current) {
        speakingFrames = Math.min(speakingFrames + 1, 10);
      } else {
        speakingFrames = Math.max(speakingFrames - 1, 0);
      }

      const currentlySpeaking = speakingFrames > 2;

      // Noise gate: if user is not speaking, gently attenuate output by 80% to kill room noise
      if (isNoiseCancellationOnRef.current && noiseGateGainRef.current && audioContextRef.current) {
        const targetGain = currentlySpeaking ? 1.0 : 0.08;
        noiseGateGainRef.current.gain.setTargetAtTime(targetGain, audioContextRef.current.currentTime, 0.04);
      }

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

      micAnimFrameRef.current = requestAnimationFrame(processAudioLevels);
    };

    micAnimFrameRef.current = requestAnimationFrame(processAudioLevels);

    const processedTrack = destination.stream.getAudioTracks()[0];
    localProcessedAudioTrackRef.current = processedTrack;
    return processedTrack;
  };

  const cleanupAudioPipeline = () => {
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
    rawSourceNodeRef.current = null;
    highPassFilterRef.current = null;
    lowPassFilterRef.current = null;
    compressorRef.current = null;
    noiseGateGainRef.current = null;
    audioDestinationRef.current = null;
    analyserRef.current = null;
    setIsLocalSpeaking(false);
  };

  // Toggle Noise Cancellation mode on/off
  const toggleNoiseCancellation = () => {
    const nextVal = !isNoiseCancellationOn;
    setIsNoiseCancellationOn(nextVal);
    if (noiseGateGainRef.current && audioContextRef.current) {
      noiseGateGainRef.current.gain.setValueAtTime(nextVal ? 1.0 : 1.0, audioContextRef.current.currentTime);
    }
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

      // Add transceivers for both audio and video to pre-reserve m-lines in SDP
      // This allows immediate track replacement when cam/mic is toggled on!
      const transceivers = pc.getTransceivers();
      if (!transceivers.some((t) => t.receiver.track.kind === 'audio')) {
        try {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
        } catch {}
      }
      if (!transceivers.some((t) => t.receiver.track.kind === 'video')) {
        try {
          pc.addTransceiver('video', { direction: 'sendrecv' });
        } catch {}
      }

      // If active tracks already exist locally, attach them to transceivers immediately
      if (localProcessedAudioTrackRef.current) {
        const at = pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio');
        if (at) {
          at.sender.replaceTrack(localProcessedAudioTrackRef.current).catch(() => {});
        }
      }
      if (localVideoStreamRef.current) {
        const vTrack = localVideoStreamRef.current.getVideoTracks().find((t) => t.readyState === 'live');
        if (vTrack) {
          const vt = pc.getTransceivers().find((t) => t.receiver.track.kind === 'video');
          if (vt) {
            vt.sender.replaceTrack(vTrack).catch(() => {});
          }
        }
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

      // Remote Track handler: handles both video and audio tracks with immediate binding
      pc.ontrack = (event) => {
        // Collect all live tracks from all receivers
        const receivers = pc.getReceivers();
        const liveTracks = receivers
          .map((r) => r.track)
          .filter((t): t is MediaStreamTrack => Boolean(t && t.readyState === 'live'));

        const fullStream = liveTracks.length > 0 ? new MediaStream(liveTracks) : event.streams[0] || new MediaStream([event.track]);
        const hasLiveVideo = fullStream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');

        setPeers((prev) => {
          const existing = prev[peerId] || {
            userId: peerId,
            userName: 'Collaborator',
            userRole: 'CANDIDATE',
            isMicOn: true,
            isCamOn: hasLiveVideo,
            isSpeaking: false
          };

          return {
            ...prev,
            [peerId]: {
              ...existing,
              stream: fullStream,
              isCamOn: hasLiveVideo || existing.isCamOn
            }
          };
        });

        // Fast video sync: immediately attach stream to video element
        setTimeout(() => {
          const videoEl = remoteVideoRefs.current[peerId];
          if (videoEl && videoEl.srcObject !== fullStream) {
            videoEl.srcObject = fullStream;
            videoEl.play().catch(() => {});
          }

          const audioEl = remoteAudioRefs.current[peerId];
          if (audioEl && audioEl.srcObject !== fullStream) {
            audioEl.srcObject = fullStream;
            audioEl.volume = 1.0;
            audioEl.muted = false;
            audioEl.play().catch((err) => {
              console.warn('[LiveMedia] Remote audio autoplay blocked:', err);
              setAutoplayBlocked(true);
            });
          }
        }, 10);
      };

      peerConnectionsRef.current[peerId] = pc;
      return pc;
    },
    [sendMessage]
  );

  // Initiate WebRTC Offer (Controlled negotiation)
  const initiateOffer = useCallback(
    async (peerId: string) => {
      if (!peerId || peerId === currentUserId) return;
      try {
        const pc = getOrCreatePeerConnection(peerId);
        if (pc.signalingState !== 'stable') return;

        makingOfferRef.current[peerId] = true;

        // Ensure transceivers have our latest live tracks
        const transceivers = pc.getTransceivers();
        if (localProcessedAudioTrackRef.current) {
          const at = transceivers.find((t) => t.receiver.track.kind === 'audio');
          if (at) {
            await at.sender.replaceTrack(localProcessedAudioTrackRef.current).catch(() => {});
          }
        }
        if (localVideoStreamRef.current) {
          const vTrack = localVideoStreamRef.current.getVideoTracks().find((t) => t.readyState === 'live');
          if (vTrack) {
            const vt = transceivers.find((t) => t.receiver.track.kind === 'video');
            if (vt) {
              await vt.sender.replaceTrack(vTrack).catch(() => {});
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

  // Fast Video Resync Trigger: re-checks tracks and re-binds video elements
  const resyncCameraFeeds = useCallback(() => {
    setIsSyncingCam(true);
    // 1. Re-bind local video
    if (localVideoRef.current && localVideoStreamRef.current) {
      localVideoRef.current.srcObject = localVideoStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }

    // 2. Broadcast status update and ping all peers
    sendMessage('MEDIA_STATUS_UPDATE', {
      isMicOn: isMicOnRef.current,
      isCamOn: isCamOnRef.current,
      isSpeaking: isLocalSpeakingRef.current,
      resyncRequested: true
    });

    Object.keys(peers).forEach((peerId) => {
      initiateOffer(peerId);
    });

    setTimeout(() => {
      setIsSyncingCam(false);
    }, 800);
  }, [peers, initiateOffer, sendMessage]);

  // Toggle Microphone with Noise Cancellation
  const toggleMic = async () => {
    const nextState = !isMicOn;
    setMediaError(null);

    try {
      if (nextState) {
        // High quality microphone constraints with browser-level echo cancellation and noise suppression
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: 1,
          sampleRate: { ideal: 48000 }
        };
        // Add Chromium-specific noise suppression constraints
        (audioConstraints as any).googEchoCancellation = true;
        (audioConstraints as any).googAutoGainControl = true;
        (audioConstraints as any).googNoiseSuppression = true;
        (audioConstraints as any).googHighpassFilter = true;
        (audioConstraints as any).googNoiseReduction = true;

        const micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        localRawAudioStreamRef.current = micStream;

        // Process through Web Audio DSP pipeline with High-pass, Low-pass, Compressor, and Noise Gate
        const cleanAudioTrack = setupNoiseCancelledAudioPipeline(micStream);
        cleanAudioTrack.enabled = true;

        // Attach clean track to all active peer connections seamlessly
        Object.entries(peerConnectionsRef.current).forEach(([peerId, pc]) => {
          if (!pc || pc.connectionState === 'closed') return;
          const transceivers = pc.getTransceivers();
          const at = transceivers.find((t) => t.receiver.track.kind === 'audio');
          if (at) {
            at.sender.replaceTrack(cleanAudioTrack).catch(() => {});
          } else {
            try {
              pc.addTrack(cleanAudioTrack);
            } catch {}
          }
        });

        setIsMicOn(true);
      } else {
        // Stop audio tracks and mute
        if (localRawAudioStreamRef.current) {
          localRawAudioStreamRef.current.getAudioTracks().forEach((t) => t.stop());
          localRawAudioStreamRef.current = null;
        }
        if (localProcessedAudioTrackRef.current) {
          localProcessedAudioTrackRef.current.stop();
          localProcessedAudioTrackRef.current = null;
        }

        cleanupAudioPipeline();

        // Mute track on peer connections
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          if (!pc || pc.connectionState === 'closed') return;
          const at = pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio');
          if (at) {
            at.sender.replaceTrack(null).catch(() => {});
          }
        });

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

  // Toggle Camera with Fast Sync and Immediate Visibility to Both Sides
  const toggleCam = async () => {
    const nextState = !isCamOn;
    setMediaError(null);

    try {
      if (nextState) {
        // Fast camera acquisition: request 720p 30fps
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          }
        });

        const videoTrack = videoStream.getVideoTracks()[0];
        localVideoStreamRef.current = videoStream;

        // 1. Immediately bind local camera feed with zero latency
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = videoStream;
          localVideoRef.current.play().catch(() => {});
        }

        // 2. Transmit video track to all active peer connections
        Object.entries(peerConnectionsRef.current).forEach(([peerId, pc]) => {
          if (!pc || pc.connectionState === 'closed') return;
          const transceivers = pc.getTransceivers();
          const vt = transceivers.find((t) => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video');
          if (vt) {
            vt.direction = 'sendrecv';
            vt.sender.replaceTrack(videoTrack).catch((err) => {
              console.warn('[LiveMedia] Video replaceTrack error:', err);
            });
          } else {
            try {
              pc.addTrack(videoTrack, videoStream);
            } catch {}
          }

          // Trigger fast renegotiation so remote peer immediately renders video
          initiateOffer(peerId);
        });

        setIsCamOn(true);
      } else {
        // Stop hardware camera tracks (turns off camera LED)
        if (localVideoStreamRef.current) {
          localVideoStreamRef.current.getVideoTracks().forEach((t) => t.stop());
          localVideoStreamRef.current = null;
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }

        // Replace track with null on all peers
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          if (!pc || pc.connectionState === 'closed') return;
          const vt = pc.getTransceivers().find((t) => t.receiver.track.kind === 'video');
          if (vt) {
            vt.sender.replaceTrack(null).catch(() => {});
          }
        });

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

          // Send current status to newcomer
          sendMessage('MEDIA_STATUS_UPDATE', {
            isMicOn: isMicOnRef.current,
            isCamOn: isCamOnRef.current,
            isSpeaking: isLocalSpeakingRef.current
          });

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

          // If peer turned on camera or requested resync, ensure peer connection is established
          if (payload.isCamOn || payload.resyncRequested) {
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

          if (offerCollision) {
            if (!isPolite) {
              // Impolite peer ignores colliding offer
              break;
            }
            // Polite peer performs rollback to accept incoming offer
            pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
          }

          pc.setRemoteDescription(new RTCSessionDescription(offer))
            .then(async () => {
              // Flush any queued ICE candidates
              const pending = pendingCandidatesRef.current[fromUserId] || [];
              for (const c of pending) {
                await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
              }
              pendingCandidatesRef.current[fromUserId] = [];

              // Attach active tracks to transceivers before creating answer
              const transceivers = pc.getTransceivers();
              if (localProcessedAudioTrackRef.current) {
                const at = transceivers.find((t) => t.receiver.track.kind === 'audio');
                if (at) {
                  await at.sender.replaceTrack(localProcessedAudioTrackRef.current).catch(() => {});
                }
              }
              if (localVideoStreamRef.current) {
                const vTrack = localVideoStreamRef.current.getVideoTracks().find((t) => t.readyState === 'live');
                if (vTrack) {
                  const vt = transceivers.find((t) => t.receiver.track.kind === 'video');
                  if (vt) {
                    await vt.sender.replaceTrack(vTrack).catch(() => {});
                  }
                }
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
          if (pc && pc.signalingState === 'have-local-offer') {
            pc.setRemoteDescription(new RTCSessionDescription(answer))
              .then(async () => {
                const pending = pendingCandidatesRef.current[fromUserId] || [];
                for (const c of pending) {
                  await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
                }
                pendingCandidatesRef.current[fromUserId] = [];
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
  }, [lastSocketMessage, currentUserId, getOrCreatePeerConnection, initiateOffer, sendMessage]);

  // Initial mount: broadcast status and connect to initial participants
  useEffect(() => {
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
      cleanupAudioPipeline();
      if (localRawAudioStreamRef.current) {
        localRawAudioStreamRef.current.getTracks().forEach((track) => track.stop());
        localRawAudioStreamRef.current = null;
      }
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((track) => track.stop());
        localVideoStreamRef.current = null;
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

  // If in docked mini bar mode (keep video elements in DOM with 0 height so WebRTC track decoder never disconnects)
  if (isDocked) {
    return (
      <div className="flex items-center justify-between gap-2 p-2 px-3 rounded-xl bg-slate-900/90 dark:bg-white/[0.04] border border-slate-700/60 dark:border-white/10 text-white backdrop-blur-md shadow-lg text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMicOn || isCamOn ? 'bg-emerald-400 opacity-75' : 'bg-indigo-400 opacity-40'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isMicOn || isCamOn ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
          </span>
          <span className="font-bold text-[11px] text-slate-200">Live Call</span>
          {isNoiseCancellationOn && (
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono flex items-center gap-0.5">
              <ShieldCheck className="w-2.5 h-2.5" /> Noise Reduced
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
              title="Expand Face-to-Face Video Call"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Video</span>
            </button>
          )}
        </div>

        {/* Hidden persistent video and audio elements so stream decoding never terminates */}
        <div className="sr-only">
          <video ref={localVideoRef} autoPlay playsInline muted />
          {activePeerList.map((peer) => (
            <React.Fragment key={peer.userId}>
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
              />
              <audio
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
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`transition-all duration-300 ${isMinimized ? 'w-auto' : 'w-full'} shrink-0`}>
      {/* Container Card with Theme Styling */}
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
              <span>Face-to-Face Video</span>
              {connectionStatus === 'connected' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-0.5">
                  <Signal className="w-2.5 h-2.5" /> P2P Live
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
            {/* Quick Fast Cam Resync */}
            <button
              onClick={resyncCameraFeeds}
              disabled={isSyncingCam}
              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition cursor-pointer"
              title="Resync Camera Feeds (Fast WebRTC Refresh)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCam ? 'animate-spin text-indigo-500' : ''}`} />
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

        {/* Media Error Message */}
        {mediaError && (
          <div className="mb-2 p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{mediaError} Check browser camera/mic permissions.</span>
          </div>
        )}

        {/* Expanded View: Video Feeds Grid (Face-to-Face) */}
        {!isMinimized && (
          <div className="space-y-2.5">
            {/* Grid of video tiles: You + Remote Collaborator */}
            <div className={`grid ${activePeerList.length > 0 ? 'grid-cols-2 gap-2' : 'grid-cols-1'} items-center`}>
              {/* Local Participant Tile */}
              <div
                className={`relative aspect-video rounded-xl overflow-hidden border ${
                  isLocalSpeaking
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'border-slate-300/40 dark:border-white/10'
                } bg-slate-950 flex flex-col items-center justify-center transition-all duration-200 shadow-inner`}
              >
                {/* Local Video Stream Element */}
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

                {/* Top Badge: Name & Role */}
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/70 text-white backdrop-blur-xs">
                    You ({currentUserRole})
                  </span>
                </div>

                {/* Bottom Badges: Mic & Sound Wave */}
                <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
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

              {/* Remote Peer Tiles */}
              {activePeerList.map((peer) => (
                <div
                  key={peer.userId}
                  className={`relative aspect-video rounded-xl overflow-hidden border ${
                    peer.isSpeaking
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'border-slate-300/40 dark:border-white/10'
                  } bg-slate-950 flex flex-col items-center justify-center transition-all duration-200 shadow-inner`}
                >
                  {/* Remote Video Stream Element */}
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

                  {/* Dedicated Remote Audio Element */}
                  <audio
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

                  {/* Top Badge: Peer Name */}
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/70 text-white backdrop-blur-xs">
                      {peer.userName}
                    </span>
                  </div>

                  {/* Bottom Badges */}
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

            {/* Waiting Notice if Solo */}
            {activePeerList.length === 0 && (
              <div className="text-center py-2 px-3 rounded-xl bg-slate-100/50 dark:bg-white/[0.02] border border-dashed border-slate-300 dark:border-white/10">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Waiting for collaborator to join the session...
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Turn your camera on anytime; it syncs automatically upon connection.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Controls Toolbar: Mic + Cam + Active Noise Cancellation Badge */}
        <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-white/10 flex flex-col gap-2">
          {/* Main Action Buttons */}
          <div className="flex items-center justify-between gap-2">
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
              title={isCamOn ? 'Turn Off Camera' : 'Turn On Camera (Fast Sync)'}
            >
              {isCamOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
              <span className="text-[11px] font-bold">{isCamOn ? 'Cam On' : 'Cam Off'}</span>
            </button>
          </div>

          {/* Noise Cancellation Control Strip */}
          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-100/60 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/5 text-[10px]">
            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
              <ShieldCheck className={`w-3.5 h-3.5 ${isNoiseCancellationOn ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span>AI Noise Cancellation</span>
              <span className="px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold uppercase">
                Active
              </span>
            </div>

            <button
              onClick={toggleNoiseCancellation}
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                isNoiseCancellationOn
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-slate-200 dark:bg-white/10 text-slate-500 hover:text-slate-700'
              }`}
              title="Toggle Web Audio DSP Noise Cancellation (Removes background fans, room echo & hiss)"
            >
              {isNoiseCancellationOn ? 'High (On)' : 'Standard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
