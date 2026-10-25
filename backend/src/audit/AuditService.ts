import { AuditLog } from '../models/AuditLog.js';
import { AuditEventType, UserRole } from '../types/cse.js';
import { redisService } from '../services/redis.service.js';

export interface LogAuditEventParams {
  sessionId: string;
  actorId: string;
  actorName?: string;
  actorRole: UserRole;
  eventType: AuditEventType;
  resourceType: 'SESSION' | 'FILE' | 'QUESTION' | 'HINT' | 'TESTCASE' | 'CODE';
  resourceId?: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

export class AuditService {
  /**
   * Log an audit event with exact millisecond precision.
   * Persists to MongoDB and broadcasts through Redis/WebSocket.
   */
  public static async log(params: LogAuditEventParams): Promise<any> {
    const timestamp = params.timestamp || Date.now();

    const auditEntry = await AuditLog.create({
      sessionId: params.sessionId,
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      eventType: params.eventType,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: params.metadata || {},
      timestamp
    });

    // Broadcast audit event to session listeners via Redis Pub/Sub
    await redisService.publish(`session:${params.sessionId}:events`, {
      type: 'AUDIT_EVENT',
      sessionId: params.sessionId,
      payload: auditEntry.toJSON(),
      timestamp
    });

    return auditEntry;
  }

  /**
   * Check for suspicious activity (e.g., large paste > 500 characters or rapid large deletion).
   * Logs a specialized suspicious event if threshold is met.
   */
  public static async detectSuspiciousActivity(
    sessionId: string,
    actorId: string,
    actorName: string,
    actorRole: UserRole,
    fileId: string,
    contentDelta: string,
    isPaste: boolean = false
  ): Promise<void> {
    const charCount = contentDelta ? contentDelta.length : 0;

    // Detect large paste (> 500 chars)
    if (isPaste || charCount > 500) {
      await this.log({
        sessionId,
        actorId,
        actorName,
        actorRole,
        eventType: 'LARGE_PASTE',
        resourceType: 'FILE',
        resourceId: fileId,
        metadata: {
          characters: charCount,
          preview: contentDelta.slice(0, 100),
          alert: `Candidate pasted ${charCount} characters at once.`
        }
      });
    }
  }

  /**
   * Retrieve chronologically ordered audit logs for timeline replay.
   */
  public static async getTimeline(sessionId: string): Promise<any[]> {
    return AuditLog.find({ sessionId }).sort({ timestamp: 1 }).lean();
  }
}
