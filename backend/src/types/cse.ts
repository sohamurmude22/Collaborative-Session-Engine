export type UserRole = 'ADMIN' | 'INTERVIEWER' | 'CANDIDATE';

export type SessionStatus = 'CREATED' | 'WAITING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export type FilePermission = 'VISIBLE_EDITABLE' | 'VISIBLE_READONLY' | 'LOCKED' | 'HIDDEN';

export type RevealStatus = 'HIDDEN' | 'REVEALED';

export type ProgrammingLanguage = 'cpp' | 'python' | 'javascript' | 'typescript';

export interface IUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  organizationId?: string;
  dob?: string;
  interests?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IOrganization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
}

export interface ISession {
  id: string;
  title: string;
  description?: string;
  interviewerId: string | IUser;
  candidateId?: string | IUser;
  organizationId?: string;
  status: SessionStatus;
  sessionCode: string;
  isScreenLocked?: boolean;
  screenLockedReason?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IFile {
  id: string;
  sessionId: string;
  name: string;
  language: ProgrammingLanguage;
  content: string;
  permission: FilePermission;
  createdAt: string;
  updatedAt: string;
}

export interface IQuestion {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  status: RevealStatus;
  order: number;
  hints?: IHint[];
  testCases?: ITestCase[];
  createdAt: string;
  updatedAt: string;
}

export interface IHint {
  id: string;
  questionId: string;
  sessionId: string;
  title: string;
  content: string;
  status: RevealStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ITestCase {
  id: string;
  questionId: string;
  sessionId: string;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  status: RevealStatus;
  createdAt: string;
  updatedAt: string;
}

export type AuditEventType =
  | 'SESSION_CREATED'
  | 'SESSION_STARTED'
  | 'SESSION_PAUSED'
  | 'SESSION_ENDED'
  | 'SESSION_RESET'
  | 'FILE_CREATED'
  | 'FILE_OPENED'
  | 'FILE_VIEWED'
  | 'FILE_EDITED'
  | 'FILE_LOCKED'
  | 'FILE_UNLOCKED'
  | 'FILE_HIDDEN'
  | 'FILE_REVEALED'
  | 'FILE_READONLY'
  | 'FILE_EDITABLE'
  | 'QUESTION_REVEALED'
  | 'HINT_REVEALED'
  | 'TESTCASE_REVEALED'
  | 'CODE_RUN'
  | 'CODE_SUBMITTED'
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'USER_WARNING'
  | 'USER_BLOCKED'
  | 'SCREEN_LOCKED'
  | 'SCREEN_UNLOCKED'
  | 'PERMISSION_CHANGED'
  | 'PERMISSION_DENIED'
  | 'LARGE_PASTE'
  | 'BURST_EDIT'
  | 'BURST_PASTE_DETECTED'
  | 'FILE_RENAMED';

export interface IAuditLog {
  id: string;
  sessionId: string;
  actorId: string;
  actorName?: string;
  actorRole: UserRole;
  eventType: AuditEventType;
  resourceType: 'SESSION' | 'FILE' | 'QUESTION' | 'HINT' | 'TESTCASE' | 'CODE';
  resourceId?: string;
  metadata?: Record<string, any>;
  timestamp: number; // Milliseconds Unix epoch
}

export interface ISessionParticipant {
  userId: string;
  name: string;
  role: UserRole;
  status: 'ONLINE' | 'OFFLINE';
  lastSeen: number;
  isBlocked?: boolean;
  isMicOn?: boolean;
  isCamOn?: boolean;
  cursor?: {
    fileId: string;
    lineNumber: number;
    column: number;
  };
}

export interface IExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number; // milliseconds
  memoryUsed?: number; // KB
  status: 'SUCCESS' | 'COMPILATION_ERROR' | 'RUNTIME_ERROR' | 'TIMEOUT';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// WebSocket message protocols
export type WSClientAction =
  | 'JOIN_SESSION'
  | 'LEAVE_SESSION'
  | 'CURSOR_MOVE'
  | 'FILE_EDIT_PING'
  | 'SUSPICIOUS_ACTIVITY'
  | 'LINE_TIMESTAMPS_UPDATE'
  | 'MEDIA_STATUS_UPDATE'
  | 'WEBRTC_OFFER'
  | 'WEBRTC_ANSWER'
  | 'WEBRTC_ICE_CANDIDATE'
  | 'RECORDING_SAVED'
  | 'CHAT_MESSAGE'
  | 'SEND_WARNING'
  | 'BLOCK_USER'
  | 'LOCK_SCREEN';

export type WSServerEvent =
  | 'SESSION_STATE'
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'USER_PRESENCE_UPDATED'
  | 'FILE_CREATED'
  | 'FILE_RENAMED'
  | 'FILE_UPDATED'
  | 'FILE_PERMISSION_CHANGED'
  | 'QUESTION_REVEALED'
  | 'HINT_REVEALED'
  | 'TESTCASE_REVEALED'
  | 'SESSION_STATUS_CHANGED'
  | 'AUDIT_EVENT'
  | 'SUSPICIOUS_ACTIVITY_ALERT'
  | 'LINE_TIMESTAMPS_UPDATE'
  | 'MEDIA_STATUS_UPDATE'
  | 'WEBRTC_OFFER'
  | 'WEBRTC_ANSWER'
  | 'WEBRTC_ICE_CANDIDATE'
  | 'RECORDING_SAVED'
  | 'CHAT_MESSAGE'
  | 'USER_WARNING'
  | 'USER_BLOCKED'
  | 'SCREEN_LOCKED'
  | 'CODE_EXECUTED'
  | 'PERMISSION_ENGINE_LOCKED'
  | 'SESSION_RESET'
  | 'ERROR';

export interface WSMessage<T = any> {
  type: WSClientAction | WSServerEvent;
  sessionId: string;
  payload: T;
  timestamp?: number;
}

