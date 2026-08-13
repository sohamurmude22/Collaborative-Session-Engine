export type Role = "candidate" | "interviewer" | "proctor";

export type FileVisibility = "visible" | "hidden";

export type AuditEventType =
  | "session_started"
  | "file_changed"
  | "file_revealed"
  | "file_hidden"
  | "file_locked"
  | "file_unlocked"
  | "edit_rejected";

export interface SessionFile {
  id: string;
  name: string;
  language: string;
  content: string;
  visibility: FileVisibility;
  locked: boolean;
}

export interface AuditEvent {
  id: string;
  sessionId: string;
  type: AuditEventType;
  actorRole: Role;
  fileId?: string;
  message: string;
  createdAt: string;
  snapshot?: unknown;
}

export interface CseSession {
  id: string;
  title: string;
  files: SessionFile[];
  events: AuditEvent[];
  createdAt: string;
}

export interface PublicSession {
  id: string;
  title: string;
  files: SessionFile[];
  events: AuditEvent[];
  role: Role;
}
