import { IUserModel } from '../models/User.js';
import { ISessionModel } from '../models/Session.js';
import { IFileModel } from '../models/File.js';
import { IQuestionModel } from '../models/Question.js';
import { IHintModel } from '../models/Hint.js';
import { ITestCaseModel } from '../models/TestCase.js';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  statusCode?: number;
}

export class PermissionEngine {
  /**
   * Helper to safely extract string ID from an ObjectId, string, or populated Mongoose document
   */
  public static extractId(idOrDoc: any): string | null {
    if (!idOrDoc) return null;
    if (typeof idOrDoc === 'string') return idOrDoc;
    if (idOrDoc._id) return idOrDoc._id.toString();
    if (idOrDoc.id) return idOrDoc.id.toString();
    try {
      const s = idOrDoc.toString();
      if (s === '[object Object]') return null;
      return s;
    } catch {
      return null;
    }
  }

  /**
   * Check if user is a member of the session (interviewer or candidate) or an admin.
   */
  public static isSessionMember(user: IUserModel, session: ISessionModel): boolean {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'INTERVIEWER') return true;

    const currentUserId = user._id ? user._id.toString() : (user as any).id;
    const interviewerId = this.extractId(session.interviewerId);
    const candidateId = this.extractId(session.candidateId);

    if (currentUserId === interviewerId || currentUserId === candidateId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user has interviewer/admin privilege for this session.
   * True if user is ADMIN, global INTERVIEWER, or the creator/host of the session.
   */
  public static isInterviewerOrAdmin(user: IUserModel, session: ISessionModel): boolean {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'INTERVIEWER') return true;

    const currentUserId = user._id ? user._id.toString() : (user as any).id;
    const interviewerId = this.extractId(session.interviewerId);

    if (interviewerId && interviewerId === currentUserId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can view a specific session.
   */
  public static canViewSession(user: IUserModel, session: ISessionModel): PermissionCheckResult {
    if (this.isSessionMember(user, session)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'You are not authorized to view this session.',
      statusCode: 403
    };
  }

  /**
   * Check if user can manage the session (start, pause, end, invite).
   */
  public static canManageSession(user: IUserModel, session: ISessionModel): PermissionCheckResult {
    const currentUserId = user._id ? user._id.toString() : (user as any).id;
    const interviewerId = this.extractId(session.interviewerId);

    if (user.role === 'ADMIN' || (interviewerId && interviewerId === currentUserId)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Only the session creator or an admin can manage or end session state.',
      statusCode: 403
    };
  }

  /**
   * Check if user can view a file.
   * If file is HIDDEN, candidate cannot view it under any circumstances.
   */
  public static canViewFile(
    user: IUserModel,
    session: ISessionModel,
    file: IFileModel
  ): PermissionCheckResult {
    if (!this.isSessionMember(user, session)) {
      return { allowed: false, reason: 'Not a session member.', statusCode: 403 };
    }

    if (this.isInterviewerOrAdmin(user, session)) {
      return { allowed: true };
    }

    // Candidate rules:
    if (file.permission === 'HIDDEN') {
      return {
        allowed: false,
        reason: 'This file is currently hidden by the interviewer.',
        statusCode: 403
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can edit a file.
   * Session must be ACTIVE (or CREATED/WAITING if interviewer).
   * Candidate CANNOT edit if file is LOCKED, HIDDEN, or VISIBLE_READONLY.
   */
  public static canEditFile(
    user: IUserModel,
    session: ISessionModel,
    file: IFileModel
  ): PermissionCheckResult {
    if (!this.isSessionMember(user, session)) {
      return { allowed: false, reason: 'Not a session member.', statusCode: 403 };
    }

    // Interviewer or Admin can always edit/prepare files
    if (this.isInterviewerOrAdmin(user, session)) {
      return { allowed: true };
    }

    // Candidate editing requirements:
    if (session.status === 'COMPLETED' || session.status === 'PAUSED') {
      return {
        allowed: false,
        reason: `Cannot edit files while session is in '${session.status}' state.`,
        statusCode: 403
      };
    }

    if (session.isScreenLocked) {
      return {
        allowed: false,
        reason: 'The session screen is currently locked by the interviewer.',
        statusCode: 403
      };
    }

    if (file.permission === 'LOCKED') {
      return {
        allowed: false,
        reason: 'This file is currently locked by the interviewer.',
        statusCode: 403
      };
    }

    if (file.permission === 'VISIBLE_READONLY') {
      return {
        allowed: false,
        reason: 'This file is marked as read-only.',
        statusCode: 403
      };
    }

    if (file.permission === 'HIDDEN') {
      return {
        allowed: false,
        reason: 'This file is hidden and cannot be edited.',
        statusCode: 403
      };
    }

    if (file.permission === 'VISIBLE_EDITABLE') {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Permission denied for file edit.',
      statusCode: 403
    };
  }

  /**
   * Check if user can change file permission (lock, unlock, hide, show, readonly, editable).
   */
  public static canChangeFilePermission(
    user: IUserModel,
    session: ISessionModel
  ): PermissionCheckResult {
    if (this.isInterviewerOrAdmin(user, session)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Only the interviewer can alter file permissions.',
      statusCode: 403
    };
  }

  /**
   * Check if user can view a question.
   * If question is HIDDEN, candidate cannot view it.
   */
  public static canViewQuestion(
    user: IUserModel,
    session: ISessionModel,
    question: IQuestionModel
  ): PermissionCheckResult {
    if (!this.isSessionMember(user, session)) {
      return { allowed: false, reason: 'Not a session member.', statusCode: 403 };
    }

    if (this.isInterviewerOrAdmin(user, session)) {
      return { allowed: true };
    }

    if (question.status === 'HIDDEN') {
      return {
        allowed: false,
        reason: 'This question has not yet been revealed by the interviewer.',
        statusCode: 403
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can view a hint.
   */
  public static canViewHint(
    user: IUserModel,
    session: ISessionModel,
    hint: IHintModel
  ): PermissionCheckResult {
    if (!this.isSessionMember(user, session)) {
      return { allowed: false, reason: 'Not a session member.', statusCode: 403 };
    }

    if (this.isInterviewerOrAdmin(user, session)) {
      return { allowed: true };
    }

    if (hint.status === 'HIDDEN') {
      return {
        allowed: false,
        reason: 'This hint has not yet been revealed.',
        statusCode: 403
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can view a testcase.
   */
  public static canViewTestCase(
    user: IUserModel,
    session: ISessionModel,
    testCase: ITestCaseModel
  ): PermissionCheckResult {
    if (!this.isSessionMember(user, session)) {
      return { allowed: false, reason: 'Not a session member.', statusCode: 403 };
    }

    if (this.isInterviewerOrAdmin(user, session)) {
      return { allowed: true };
    }

    if (testCase.status === 'HIDDEN') {
      return {
        allowed: false,
        reason: 'This test case is hidden.',
        statusCode: 403
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can execute code in this session.
   */
  public static canRunCode(user: IUserModel, session: ISessionModel): PermissionCheckResult {
    if (!this.isSessionMember(user, session)) {
      return { allowed: false, reason: 'Not a session member.', statusCode: 403 };
    }

    if (user.role === 'CANDIDATE' && (session.status === 'COMPLETED' || session.status === 'PAUSED')) {
      return {
        allowed: false,
        reason: `Cannot execute code while session is '${session.status}'.`,
        statusCode: 403
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can reveal progressive resources (questions, hints, testcases).
   */
  public static canRevealResource(
    user: IUserModel,
    session: ISessionModel
  ): PermissionCheckResult {
    if (this.isInterviewerOrAdmin(user, session)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Only the session host or admin can reveal hidden resources.',
      statusCode: 403
    };
  }

  /**
   * Check if user can issue warnings to participants.
   */
  public static canIssueWarning(user: IUserModel, session: ISessionModel): PermissionCheckResult {
    if (this.isInterviewerOrAdmin(user, session)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Only the interviewer can issue warnings to candidates.',
      statusCode: 403
    };
  }

  /**
   * Check if user can block participants for suspicious activity.
   */
  public static canBlockUser(user: IUserModel, session: ISessionModel): PermissionCheckResult {
    if (this.isInterviewerOrAdmin(user, session)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Only the interviewer can block participants for suspicious activity.',
      statusCode: 403
    };
  }
}

