export type UserRole = 'ADMIN' | 'INTERVIEWER' | 'CANDIDATE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  friends?: User[];
  createdAt?: string;
  updatedAt?: string;
}

export type SessionStatus = 'WAITING' | 'ACTIVE' | 'ENDED';

export interface Session {
  id: string;
  title: string;
  description: string;
  createdBy: User | string;
  participants: (User | string)[];
  language: string;
  status: SessionStatus;
  code?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCheckResponse {
  success: boolean;
  message: string;
  timestamp?: string;
  database?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  user?: User;
  users?: User[];
  friends?: User[];
  session?: Session;
  sessions?: Session[];
  code?: string;
  count?: number;
}

export interface CreateSessionPayload {
  title: string;
  description?: string;
  language: string;
  code?: string;
}
