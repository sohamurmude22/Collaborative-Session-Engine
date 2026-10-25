import axios from 'axios';
import {
  ApiResponse,
  IUser,
  ISession,
  IFile,
  IQuestion,
  IHint,
  ITestCase,
  IAuditLog,
  IExecutionResult,
  FilePermission
} from '../types/cse.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Attach bearer token if stored in localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cse_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Authentication Service
export const authService = {
  async register(
    name: string,
    email: string,
    password: string,
    role?: string,
    dob?: string,
    interests?: string | string[]
  ): Promise<ApiResponse<{ token: string; user: IUser }>> {
    const res = await apiClient.post<ApiResponse<{ token: string; user: IUser }>>('/auth/register', {
      name,
      email,
      password,
      role,
      dob,
      interests
    });
    if (res.data.data?.token) {
      localStorage.setItem('cse_token', res.data.data.token);
    }
    return res.data;
  },


  async login(email: string, password: string): Promise<ApiResponse<{ token: string; user: IUser }>> {
    const res = await apiClient.post<ApiResponse<{ token: string; user: IUser }>>('/auth/login', {
      email,
      password
    });
    if (res.data.data?.token) {
      localStorage.setItem('cse_token', res.data.data.token);
    }
    return res.data;
  },

  async logout(): Promise<ApiResponse> {
    const res = await apiClient.post<ApiResponse>('/auth/logout');
    localStorage.removeItem('cse_token');
    return res.data;
  },

  async getCurrentUser(): Promise<ApiResponse<{ user: IUser }>> {
    const res = await apiClient.get<ApiResponse<{ user: IUser }>>('/auth/me');
    return res.data;
  },

  async updateProfile(payload: {
    name?: string;
    avatarUrl?: string;
    dob?: string;
    interests?: string | string[];
  }): Promise<ApiResponse<{ user: IUser }>> {
    const res = await apiClient.put<ApiResponse<{ user: IUser }>>('/auth/profile', payload);
    return res.data;
  },
};

// Session Service
export const sessionService = {
  async getAll(): Promise<ISession[]> {
    const res = await apiClient.get<ApiResponse<ISession[]>>('/sessions');
    return res.data.data || [];
  },

  async getById(sessionId: string): Promise<ISession> {
    const res = await apiClient.get<ApiResponse<ISession>>(`/sessions/${sessionId}`);
    return res.data.data!;
  },

  async getByCode(code: string): Promise<ISession> {
    const res = await apiClient.get<ApiResponse<ISession>>(`/sessions/code/${code}`);
    return res.data.data!;
  },

  async create(payload: {
    title: string;
    description?: string;
    candidateEmail?: string;
    questions?: Array<{
      title: string;
      description: string;
      difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
      status?: 'HIDDEN' | 'REVEALED';
    }>;
  }): Promise<ISession> {
    const res = await apiClient.post<ApiResponse<ISession>>('/sessions', payload);
    return res.data.data!;
  },

  async start(sessionId: string): Promise<ISession> {
    const res = await apiClient.post<ApiResponse<ISession>>(`/sessions/${sessionId}/start`);
    return res.data.data!;
  },

  async pause(sessionId: string): Promise<ISession> {
    const res = await apiClient.post<ApiResponse<ISession>>(`/sessions/${sessionId}/pause`);
    return res.data.data!;
  },

  async end(sessionId: string): Promise<ISession> {
    const res = await apiClient.post<ApiResponse<ISession>>(`/sessions/${sessionId}/end`);
    return res.data.data!;
  },

  async delete(sessionId: string): Promise<any> {
    const res = await apiClient.delete<ApiResponse<any>>(`/sessions/${sessionId}`);
    return res.data.data;
  },

  async getTimeline(sessionId: string): Promise<IAuditLog[]> {
    const res = await apiClient.get<ApiResponse<IAuditLog[]>>(`/sessions/${sessionId}/timeline`);
    return res.data.data || [];
  },

  async getAuditLogs(sessionId: string): Promise<IAuditLog[]> {
    const res = await apiClient.get<ApiResponse<IAuditLog[]>>(`/sessions/${sessionId}/audit`);
    return res.data.data || [];
  },

  async executeCode(
    sessionId: string,
    payload: { fileId?: string; code?: string; language?: string; stdinInput?: string }
  ): Promise<IExecutionResult> {
    const res = await apiClient.post<ApiResponse<IExecutionResult>>(`/sessions/${sessionId}/execute`, payload);
    return res.data.data!;
  },

  async getUsersList(): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
    const res = await apiClient.get<ApiResponse<Array<{ id: string; name: string; email: string; role: string }>>>('/sessions/users/list');
    return res.data.data || [];
  },

  async addParticipant(
    sessionId: string,
    payload: { email?: string; userId?: string; role?: string }
  ): Promise<any> {
    const res = await apiClient.post<ApiResponse<any>>(`/sessions/${sessionId}/participants`, payload);
    return res.data.data!;
  },

  async toggleMasterLock(
    sessionId: string,
    locked: boolean
  ): Promise<{ locked: boolean; message: string; files: IFile[] }> {
    const res = await apiClient.post<ApiResponse<{ locked: boolean; message: string; files: IFile[] }>>(
      `/sessions/${sessionId}/master-lock`,
      { locked }
    );
    return res.data.data!;
  },

  async leave(sessionId: string, resetDatabase: boolean = true): Promise<any> {
    const res = await apiClient.post<ApiResponse<any>>(`/sessions/${sessionId}/leave`, { resetDatabase });
    return res.data.data;
  },

  async issueWarning(sessionId: string, targetUserId: string, message: string): Promise<any> {
    const res = await apiClient.post<ApiResponse<any>>(`/sessions/${sessionId}/warning`, {
      targetUserId,
      message
    });
    return res.data.data;
  },

  async blockUser(sessionId: string, targetUserId: string, reason?: string): Promise<any> {
    const res = await apiClient.post<ApiResponse<any>>(`/sessions/${sessionId}/block`, {
      targetUserId,
      reason
    });
    return res.data.data;
  },

  async unblockUser(sessionId: string, targetUserId: string): Promise<any> {
    const res = await apiClient.post<ApiResponse<any>>(`/sessions/${sessionId}/unblock`, {
      targetUserId
    });
    return res.data.data;
  },

  async lockScreen(sessionId: string, reason?: string): Promise<any> {
    const res = await apiClient.post<ApiResponse<any>>(`/sessions/${sessionId}/lock-screen`, {
      reason
    });
    return res.data.data;
  },

  async unlockScreen(sessionId: string): Promise<any> {
    const res = await apiClient.post<ApiResponse<any>>(`/sessions/${sessionId}/unlock-screen`);
    return res.data.data;
  },

  async resetSystemDatabase(): Promise<any> {
    const res = await apiClient.post<ApiResponse<any>>('/sessions/reset-system-database');
    return res.data.data;
  }
};


// File Service with Dynamic Permissions
export const fileService = {
  async getFiles(sessionId: string): Promise<IFile[]> {
    const res = await apiClient.get<ApiResponse<IFile[]>>(`/sessions/${sessionId}/files`);
    return res.data.data || [];
  },

  async getFile(fileId: string): Promise<IFile> {
    const res = await apiClient.get<ApiResponse<IFile>>(`/files/${fileId}`);
    return res.data.data!;
  },

  async createFile(
    sessionId: string,
    file: { name: string; language?: string; content?: string; permission?: FilePermission }
  ): Promise<IFile> {
    const res = await apiClient.post<ApiResponse<IFile>>(`/sessions/${sessionId}/files`, file);
    return res.data.data!;
  },

  async updateFile(
    fileId: string,
    payload: { content?: string; delta?: string; isPaste?: boolean; line?: number }
  ): Promise<IFile> {
    const res = await apiClient.patch<ApiResponse<IFile>>(`/files/${fileId}`, payload);
    return res.data.data!;
  },

  async renameFile(fileId: string, name: string): Promise<IFile> {
    const res = await apiClient.patch<ApiResponse<IFile>>(`/files/${fileId}/rename`, { name });
    return res.data.data!;
  },

  async lock(fileId: string): Promise<IFile> {
    const res = await apiClient.post<ApiResponse<IFile>>(`/files/${fileId}/lock`);
    return res.data.data!;
  },

  async unlock(fileId: string): Promise<IFile> {
    const res = await apiClient.post<ApiResponse<IFile>>(`/files/${fileId}/unlock`);
    return res.data.data!;
  },

  async hide(fileId: string): Promise<IFile> {
    const res = await apiClient.post<ApiResponse<IFile>>(`/files/${fileId}/hide`);
    return res.data.data!;
  },

  async show(fileId: string): Promise<IFile> {
    const res = await apiClient.post<ApiResponse<IFile>>(`/files/${fileId}/show`);
    return res.data.data!;
  },

  async readonly(fileId: string): Promise<IFile> {
    const res = await apiClient.post<ApiResponse<IFile>>(`/files/${fileId}/readonly`);
    return res.data.data!;
  },

  async editable(fileId: string): Promise<IFile> {
    const res = await apiClient.post<ApiResponse<IFile>>(`/files/${fileId}/editable`);
    return res.data.data!;
  },

  async delete(fileId: string): Promise<void> {
    await apiClient.delete(`/files/${fileId}`);
  },

  async getSessionStorage(sessionId: string): Promise<any> {
    const res = await apiClient.get<ApiResponse<any>>(`/sessions/${sessionId}/storage`);
    return res.data.data;
  }
};

// Progressive Reveal Resource Service
export const resourceService = {
  async getQuestions(sessionId: string): Promise<IQuestion[]> {
    const res = await apiClient.get<ApiResponse<IQuestion[]>>(`/sessions/${sessionId}/questions`);
    return res.data.data || [];
  },

  async createQuestion(
    sessionId: string,
    payload: { title: string; description: string; difficulty?: string }
  ): Promise<IQuestion> {
    const res = await apiClient.post<ApiResponse<IQuestion>>(`/sessions/${sessionId}/questions`, payload);
    return res.data.data!;
  },

  async revealQuestion(questionId: string): Promise<IQuestion> {
    const res = await apiClient.post<ApiResponse<IQuestion>>(`/questions/${questionId}/reveal`);
    return res.data.data!;
  },

  async createHint(
    questionId: string,
    payload: { title: string; content: string }
  ): Promise<IHint> {
    const res = await apiClient.post<ApiResponse<IHint>>(`/questions/${questionId}/hints`, payload);
    return res.data.data!;
  },

  async revealHint(hintId: string): Promise<IHint> {
    const res = await apiClient.post<ApiResponse<IHint>>(`/hints/${hintId}/reveal`);
    return res.data.data!;
  },

  async updateQuestion(
    questionId: string,
    payload: { title?: string; description?: string; difficulty?: string; status?: string }
  ): Promise<IQuestion> {
    const res = await apiClient.put<ApiResponse<IQuestion>>(`/questions/${questionId}`, payload);
    return res.data.data!;
  },

  async deleteQuestion(questionId: string): Promise<void> {
    await apiClient.delete(`/questions/${questionId}`);
  },

  async createTestCase(
    questionId: string,
    payload: { input: string; expectedOutput: string; isSample?: boolean }
  ): Promise<ITestCase> {
    const res = await apiClient.post<ApiResponse<ITestCase>>(`/questions/${questionId}/testcases`, payload);
    return res.data.data!;
  },

  async revealTestCase(testCaseId: string): Promise<ITestCase> {
    const res = await apiClient.post<ApiResponse<ITestCase>>(`/testcases/${testCaseId}/reveal`);
    return res.data.data!;
  }
};

// Friends & Study Buddies Service
export const friendService = {
  async getFriends(): Promise<IUser[]> {
    const res = await apiClient.get<ApiResponse<IUser[]> & { friends: IUser[] }>('/friends');
    return res.data.friends || res.data.data || [];
  },

  async searchUsers(query: string): Promise<IUser[]> {
    const res = await apiClient.get<ApiResponse<IUser[]> & { users: IUser[] }>(`/friends/search?q=${encodeURIComponent(query)}`);
    return res.data.users || res.data.data || [];
  },

  async addFriend(payload: { email?: string; userId?: string }): Promise<{ message: string; friends: IUser[] }> {
    const res = await apiClient.post<ApiResponse<any> & { friends: IUser[]; message: string }>('/friends/add', payload);
    return {
      message: res.data.message || 'Friend added successfully',
      friends: res.data.friends || []
    };
  },

  async removeFriend(friendId: string): Promise<{ message: string; friends: IUser[] }> {
    const res = await apiClient.delete<ApiResponse<any> & { friends: IUser[]; message: string }>(`/friends/${friendId}`);
    return {
      message: res.data.message || 'Friend removed successfully',
      friends: res.data.friends || []
    };
  },

  async startSessionWithFriend(payload: {
    friendId: string;
    title?: string;
    language?: string;
  }): Promise<{ session: ISession; sessionCode: string }> {
    const res = await apiClient.post<ApiResponse<any> & { session: ISession; sessionCode: string }>(
      '/friends/start-session',
      payload
    );
    return {
      session: res.data.session,
      sessionCode: res.data.sessionCode
    };
  }
};

