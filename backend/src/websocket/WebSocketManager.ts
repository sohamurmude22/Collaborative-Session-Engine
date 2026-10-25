import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import url from 'url';
import { User, IUserModel } from '../models/User.js';
import { Session, ISessionModel } from '../models/Session.js';
import { SessionParticipant } from '../models/SessionParticipant.js';
import { File } from '../models/File.js';
import { PermissionEngine } from '../permissions/PermissionEngine.js';
import { AuditService } from '../audit/AuditService.js';
import { redisService } from '../services/redis.service.js';
import { WSMessage } from '../types/cse.js';

interface AuthenticatedWebSocket extends WebSocket {
  isAlive: boolean;
  user?: IUserModel;
  sessionId?: string;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private sessionClients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private redisCallbackMap: Map<string, (event: any) => void> = new Map();
  private pendingSaves: Map<string, { content: string; timeout: NodeJS.Timeout }> = new Map();

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.init();
  }

  private init() {
    this.wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Parse query params for token and session
      const parsedUrl = url.parse(req.url || '', true);
      const token = parsedUrl.query.token as string;
      const sessionCodeOrId = parsedUrl.query.session as string;

      if (!token) {
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Authentication required' } }));
        ws.close(4001, 'Authentication token missing');
        return;
      }

      // Verify JWT
      try {
        const secret = process.env.JWT_SECRET || 'collaborative_session_engine_secret_jwt_key_2026';
        const decoded = jwt.verify(token, secret) as { userId: string };
        const user = await User.findById(decoded.userId);

        if (!user) {
          ws.close(4002, 'User not found');
          return;
        }

        ws.user = user;

        if (sessionCodeOrId) {
          await this.handleJoinSession(ws, sessionCodeOrId);
        }
      } catch (err: any) {
        ws.close(4003, 'Invalid token: ' + err.message);
        return;
      }

      ws.on('message', async (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          await this.handleClientMessage(ws, message);
        } catch (err: any) {
          ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Invalid message payload' } }));
        }
      });

      ws.on('close', () => {
        this.handleClientDisconnect(ws);
      });

      ws.on('error', (err) => {
        console.warn('[WebSocket] Client socket error:', err.message);
        this.handleClientDisconnect(ws);
      });
    });

    // Heartbeat check every 30 seconds
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: any) => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        try {
          ws.ping();
        } catch {
          ws.terminate();
        }
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  private async handleJoinSession(ws: AuthenticatedWebSocket, sessionIdentifier: string) {
    if (!ws.user) return;

    // Session identifier can be ID or SessionCode
    let session = await Session.findOne({
      $or: [
        { _id: sessionIdentifier.match(/^[0-9a-fA-F]{24}$/) ? sessionIdentifier : null },
        { sessionCode: sessionIdentifier.toUpperCase() }
      ]
    });

    if (!session) {
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Session not found' } }));
      return;
    }

    const sessionId = session._id.toString();
    ws.sessionId = sessionId;

    // Track client in session set
    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, new Set());

      // Dedicated Redis callback handler for this session room
      const redisHandler = (event: any) => {
        this.broadcastToSession(sessionId, event);
      };
      this.redisCallbackMap.set(sessionId, redisHandler);
      redisService.subscribe(`session:${sessionId}:events`, redisHandler);
    }

    this.sessionClients.get(sessionId)!.add(ws);

    // Update SessionParticipant in DB asynchronously (non-blocking)
    SessionParticipant.findOneAndUpdate(
      { sessionId: session._id, userId: ws.user._id },
      {
        role: ws.user.role,
        status: 'ONLINE',
        lastSeen: Date.now()
      },
      { upsert: true, new: true }
    ).catch(() => {});

    // Send active session snapshot to the newly connected user immediately
    SessionParticipant.find({ sessionId: session._id, status: 'ONLINE' })
      .populate('userId', 'name role email avatarUrl')
      .then((participants) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'SESSION_STATE',
              sessionId,
              payload: {
                sessionStatus: session?.status,
                participants: participants.map((p: any) => ({
                  userId: p.userId?._id?.toString() || p.userId,
                  name: p.userId?.name || 'User',
                  role: p.role,
                  status: p.status,
                  avatarUrl: p.userId?.avatarUrl || ''
                }))
              }
            })
          );
        }
      })
      .catch(() => {});

    // Broadcast user joined to other clients
    this.broadcastToSession(
      sessionId,
      {
        type: 'USER_JOINED',
        sessionId,
        payload: {
          userId: ws.user._id.toString(),
          name: ws.user.name,
          role: ws.user.role,
          avatarUrl: ws.user.avatarUrl || '',
          status: 'ONLINE'
        }
      },
      ws
    );
  }

  private async handleClientMessage(ws: AuthenticatedWebSocket, message: WSMessage) {
    if (!ws.user || !ws.sessionId) return;
    const sessionId = ws.sessionId;

    switch (message.type) {
      case 'CURSOR_MOVE': {
        this.broadcastToSession(
          sessionId,
          {
            type: 'USER_PRESENCE_UPDATED',
            sessionId,
            payload: {
              userId: ws.user._id.toString(),
              name: ws.user.name,
              cursor: message.payload?.cursor
            }
          },
          ws
        );
        break;
      }

      case 'FILE_EDIT_PING': {
        const { fileId, content, delta, isPaste } = message.payload || {};
        if (!fileId) return;

        // 1. Broadcast immediately to peers for zero-latency collaboration
        this.broadcastToSession(
          sessionId,
          {
            type: 'FILE_UPDATED',
            sessionId,
            payload: {
              fileId,
              content,
              updatedBy: ws.user.name,
              updatedById: ws.user._id.toString()
            }
          },
          ws
        );

        // 2. Debounce MongoDB persistence (1200ms) to prevent DB thrashing & event loop starvation
        const saveKey = `${sessionId}:${fileId}`;
        const existing = this.pendingSaves.get(saveKey);
        if (existing) {
          clearTimeout(existing.timeout);
        }

        const timeout = setTimeout(async () => {
          this.pendingSaves.delete(saveKey);
          try {
            if (content !== undefined) {
              await File.findByIdAndUpdate(fileId, { content });
            }
          } catch (err: any) {
            console.error('[WebSocket] Debounced save failed:', err?.message);
          }
        }, 1200);

        this.pendingSaves.set(saveKey, { content: content || '', timeout });

        // 3. Detect suspicious activity on copy-paste or rapid insertion (> 30 chars or explicit paste)
        const deltaStr = typeof delta === 'string' ? delta : '';
        const isSuspiciousPaste = isPaste || deltaStr.length >= 35;

        if (isSuspiciousPaste && ws.user.role === 'CANDIDATE') {
          const charLen = deltaStr.length;
          const alertMessage = `🚨 Suspicious Activity: Copy-Paste detected from candidate ${ws.user.name} (+${charLen} chars)!`;

          AuditService.log({
            sessionId,
            actorId: ws.user._id.toString(),
            actorName: ws.user.name,
            actorRole: ws.user.role,
            eventType: 'BURST_PASTE_DETECTED',
            resourceType: 'FILE',
            resourceId: fileId,
            metadata: {
              characters: charLen,
              preview: deltaStr.slice(0, 120),
              alert: alertMessage
            }
          }).catch(() => {});

          // Immediately alert the interviewer with dedicated high-priority alert
          this.broadcastToSession(sessionId, {
            type: 'SUSPICIOUS_ACTIVITY_ALERT',
            sessionId,
            payload: {
              alertType: 'COPY_PASTE',
              eventType: 'BURST_PASTE_DETECTED',
              actorId: ws.user._id.toString(),
              actorName: ws.user.name,
              actorRole: ws.user.role,
              fileId,
              charCount: charLen,
              preview: deltaStr.slice(0, 120),
              timestamp: Date.now(),
              message: alertMessage
            }
          });
        }

        break;
      }

      case 'CHAT_MESSAGE': {
        const chatPayload = {
          id: message.payload?.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sessionId,
          senderId: ws.user._id.toString(),
          senderName: ws.user.name,
          senderRole: ws.user.role,
          avatarUrl: ws.user.avatarUrl || '',
          message: message.payload?.message || '',
          timestamp: Date.now()
        };
        this.broadcastToSession(sessionId, {
          type: 'CHAT_MESSAGE',
          sessionId,
          payload: chatPayload
        });
        break;
      }

      case 'SEND_WARNING': {
        if (!PermissionEngine.isInterviewerOrAdmin(ws.user, { interviewerId: ws.user._id } as any)) {
          ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Only interviewers can issue warnings.' } }));
          break;
        }
        const warningPayload = {
          issuerId: ws.user._id.toString(),
          issuerName: ws.user.name,
          targetUserId: message.payload?.targetUserId,
          message: message.payload?.message || 'Warning: Suspicious activity detected.',
          timestamp: Date.now()
        };
        this.broadcastToSession(sessionId, {
          type: 'USER_WARNING',
          sessionId,
          payload: warningPayload
        });
        AuditService.log({
          sessionId,
          actorId: ws.user._id.toString(),
          actorName: ws.user.name,
          actorRole: ws.user.role,
          eventType: 'USER_WARNING',
          resourceType: 'SESSION',
          resourceId: message.payload?.targetUserId,
          metadata: warningPayload
        }).catch(() => {});
        break;
      }

      case 'BLOCK_USER': {
        if (!PermissionEngine.isInterviewerOrAdmin(ws.user, { interviewerId: ws.user._id } as any)) {
          ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Only interviewers can block participants.' } }));
          break;
        }
        const blockTargetId = message.payload?.targetUserId;
        const blockReason = message.payload?.reason || 'Suspicious activity detected.';
        SessionParticipant.findOneAndUpdate(
          { sessionId, userId: blockTargetId },
          { isBlocked: true, blockedReason: blockReason }
        ).catch(() => {});
        File.updateMany({ sessionId }, { permission: 'LOCKED' }).catch(() => {});

        this.broadcastToSession(sessionId, {
          type: 'USER_BLOCKED',
          sessionId,
          payload: {
            targetUserId: blockTargetId,
            blockedBy: ws.user.name,
            reason: blockReason,
            timestamp: Date.now()
          }
        });
        AuditService.log({
          sessionId,
          actorId: ws.user._id.toString(),
          actorName: ws.user.name,
          actorRole: ws.user.role,
          eventType: 'USER_BLOCKED',
          resourceType: 'SESSION',
          resourceId: blockTargetId,
          metadata: { reason: blockReason }
        }).catch(() => {});
        break;
      }

      case 'LOCK_SCREEN': {
        if (!PermissionEngine.isInterviewerOrAdmin(ws.user, { interviewerId: ws.user._id } as any)) {
          ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Only interviewers can lock candidate screen.' } }));
          break;
        }
        const isScreenLocked = !!message.payload?.isScreenLocked;
        const lockReason = message.payload?.reason || (isScreenLocked ? 'Session screen locked by interviewer.' : '');

        Session.findByIdAndUpdate(sessionId, {
          isScreenLocked,
          screenLockedReason: lockReason
        }).catch(() => {});

        this.broadcastToSession(sessionId, {
          type: 'SCREEN_LOCKED',
          sessionId,
          payload: {
            isScreenLocked,
            lockedBy: ws.user.name,
            reason: lockReason,
            timestamp: Date.now()
          }
        });

        AuditService.log({
          sessionId,
          actorId: ws.user._id.toString(),
          actorName: ws.user.name,
          actorRole: ws.user.role,
          eventType: isScreenLocked ? 'SCREEN_LOCKED' : 'SCREEN_UNLOCKED',
          resourceType: 'SESSION',
          resourceId: sessionId,
          metadata: { reason: lockReason }
        }).catch(() => {});
        break;
      }

      case 'SUSPICIOUS_ACTIVITY': {
        const details = message.payload?.details || {};
        const eventType = message.payload?.eventType || 'BURST_PASTE_DETECTED';
        const alertMsg =
          details?.alert ||
          `🚨 Suspicious Activity: Copy-Paste detected from candidate ${ws.user.name} (+${details?.insertedChars || details?.charCount || 'several'} chars)!`;

        AuditService.log({
          sessionId,
          actorId: ws.user._id.toString(),
          actorName: ws.user.name,
          actorRole: ws.user.role,
          eventType,
          resourceType: 'FILE',
          resourceId: message.payload?.fileId,
          metadata: { ...details, alert: alertMsg }
        }).catch(() => {});

        // Broadcast red alert directly to the interviewer
        this.broadcastToSession(sessionId, {
          type: 'SUSPICIOUS_ACTIVITY_ALERT',
          sessionId,
          payload: {
            alertType: 'COPY_PASTE',
            eventType,
            actorId: ws.user._id.toString(),
            actorName: ws.user.name,
            actorRole: ws.user.role,
            fileId: message.payload?.fileId,
            lineNumber: details?.lineNumber || 1,
            charCount: details?.insertedChars || details?.charCount || 0,
            preview: details?.preview || '',
            timestamp: Date.now(),
            message: alertMsg
          }
        });

        // Also broadcast standard audit event
        this.broadcastToSession(sessionId, {
          type: 'AUDIT_EVENT',
          sessionId,
          payload: {
            eventType,
            actorId: ws.user._id.toString(),
            actorName: ws.user.name,
            actorRole: ws.user.role,
            metadata: { ...details, alert: alertMsg },
            timestamp: Date.now()
          }
        });
        break;
      }

      case 'LINE_TIMESTAMPS_UPDATE': {
        // Forward line timestamps to session room so interviewer can inspect live
        this.broadcastToSession(
          sessionId,
          {
            type: 'LINE_TIMESTAMPS_UPDATE',
            sessionId,
            payload: {
              fileId: message.payload?.fileId,
              lines: message.payload?.lines,
              updatedAt: Date.now()
            }
          },
          ws
        );
        break;
      }


      case 'MEDIA_STATUS_UPDATE': {
        this.broadcastToSession(
          sessionId,
          {
            type: 'MEDIA_STATUS_UPDATE',
            sessionId,
            payload: {
              userId: ws.user._id.toString(),
              userName: ws.user.name,
              userRole: ws.user.role,
              avatarUrl: ws.user.avatarUrl || '',
              isMicOn: !!message.payload?.isMicOn,
              isCamOn: !!message.payload?.isCamOn,
              isSpeaking: !!message.payload?.isSpeaking
            }
          },
          ws
        );
        break;
      }

      case 'WEBRTC_OFFER':
      case 'WEBRTC_ANSWER':
      case 'WEBRTC_ICE_CANDIDATE': {
        this.broadcastToSession(
          sessionId,
          {
            type: message.type,
            sessionId,
            payload: {
              ...message.payload,
              fromUserId: ws.user._id.toString(),
              fromUserName: ws.user.name,
              fromUserRole: ws.user.role
            }
          },
          ws
        );
        break;
      }

      case 'RECORDING_SAVED': {
        this.broadcastToSession(
          sessionId,
          {
            type: 'RECORDING_SAVED',
            sessionId,
            payload: {
              ...message.payload,
              savedBy: ws.user.name,
              savedAt: Date.now()
            }
          },
          ws
        );
        break;
      }

      default:
        break;
    }
  }

  private handleClientDisconnect(ws: AuthenticatedWebSocket) {
    if (!ws.sessionId || !ws.user) return;
    const sessionId = ws.sessionId;

    const clients = this.sessionClients.get(sessionId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        this.sessionClients.delete(sessionId);
        const redisHandler = this.redisCallbackMap.get(sessionId);
        if (redisHandler) {
          redisService.unsubscribe(`session:${sessionId}:events`, redisHandler);
          this.redisCallbackMap.delete(sessionId);
        }
      }
    }

    // Update DB status asynchronously
    SessionParticipant.findOneAndUpdate(
      { sessionId, userId: ws.user._id },
      { status: 'OFFLINE', leftAt: new Date(), lastSeen: Date.now() }
    ).catch(() => {});

    // Broadcast user left
    this.broadcastToSession(sessionId, {
      type: 'USER_LEFT',
      sessionId,
      payload: {
        userId: ws.user._id.toString(),
        name: ws.user.name
      }
    });
  }

  private broadcastToSession(sessionId: string, message: any, excludeWs?: AuthenticatedWebSocket) {
    const clients = this.sessionClients.get(sessionId);
    if (!clients || clients.size === 0) return;

    const serialized = typeof message === 'string' ? message : JSON.stringify(message);

    clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        try {
          client.send(serialized);
        } catch {
          // If socket send fails, ignore and let heartbeat close it
        }
      }
    });
  }
}
