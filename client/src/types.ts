export type Role = "candidate" | "interviewer" | "proctor";
export type FileVisibility = "visible" | "hidden";

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
  type: string;
  actorRole: Role;
  fileId?: string;
  message: string;
  createdAt: string;
  snapshot?: unknown;
}

export interface PublicSession {
  id: string;
  title: string;
  role: Role;
  files: SessionFile[];
  events: AuditEvent[];
}
