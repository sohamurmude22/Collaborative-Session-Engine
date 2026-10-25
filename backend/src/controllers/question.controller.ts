import { Response } from 'express';
import { Session } from '../models/Session.js';
import { Question } from '../models/Question.js';
import { Hint } from '../models/Hint.js';
import { TestCase } from '../models/TestCase.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { PermissionEngine } from '../permissions/PermissionEngine.js';
import { AuditService } from '../audit/AuditService.js';
import { redisService } from '../services/redis.service.js';

export const getQuestions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    const isInterviewerOrAdmin = PermissionEngine.isInterviewerOrAdmin(user, session);

    // If candidate, query ONLY REVEALED questions
    const qQuery: any = { sessionId };
    if (!isInterviewerOrAdmin) {
      qQuery.status = 'REVEALED';
    }

    const questions = await Question.find(qQuery).sort({ order: 1 });

    // Populate revealed hints and testcases for each question
    const questionsWithExtras = await Promise.all(
      questions.map(async (q) => {
        const hQuery: any = { questionId: q._id };
        const tQuery: any = { questionId: q._id };

        if (!isInterviewerOrAdmin) {
          hQuery.status = 'REVEALED';
          tQuery.status = 'REVEALED';
        }

        const hints = await Hint.find(hQuery).sort({ order: 1 });
        const testCases = await TestCase.find(tQuery);

        return {
          ...q.toJSON(),
          hints,
          testCases
        };
      })
    );

    res.status(200).json({
      success: true,
      data: questionsWithExtras
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const createQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { sessionId } = req.params;
    const { title, description, difficulty, order, status } = req.body;

    const session = await Session.findById(sessionId);
    if (!session || !PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only interviewers can add questions.' }
      });
      return;
    }

    const question = await Question.create({
      sessionId,
      title,
      description,
      difficulty: difficulty || 'MEDIUM',
      order: order || 1,
      status: status || 'HIDDEN'
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'QUESTION_CREATED',
      sessionId: session._id.toString(),
      payload: question.toJSON()
    });

    res.status(201).json({ success: true, data: question });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const revealQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const question = await Question.findById(id);
    if (!question) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Question not found.' }
      });
      return;
    }

    const session = await Session.findById(question.sessionId);
    if (!session || !PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only interviewers can reveal questions.' }
      });
      return;
    }

    question.status = 'REVEALED';
    await question.save();

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'QUESTION_REVEALED',
      resourceType: 'QUESTION',
      resourceId: question._id.toString(),
      metadata: { title: question.title }
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'QUESTION_REVEALED',
      sessionId: session._id.toString(),
      payload: question.toJSON()
    });

    res.status(200).json({ success: true, data: question });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const createHint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id: questionId } = req.params;
    const { title, content, order, status } = req.body;

    const question = await Question.findById(questionId);
    if (!question) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Question not found.' }
      });
      return;
    }

    const session = await Session.findById(question.sessionId);
    if (!session || !PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only interviewers can add hints.' }
      });
      return;
    }

    const hint = await Hint.create({
      questionId,
      sessionId: session._id,
      title,
      content,
      order: order || 1,
      status: status || 'HIDDEN'
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'HINT_CREATED',
      sessionId: session._id.toString(),
      payload: hint.toJSON()
    });

    res.status(201).json({ success: true, data: hint });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const revealHint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const hint = await Hint.findById(id);
    if (!hint) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Hint not found.' }
      });
      return;
    }

    const session = await Session.findById(hint.sessionId);
    if (!session || !PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only interviewers can reveal hints.' }
      });
      return;
    }

    hint.status = 'REVEALED';
    await hint.save();

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'HINT_REVEALED',
      resourceType: 'HINT',
      resourceId: hint._id.toString(),
      metadata: { title: hint.title }
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'HINT_REVEALED',
      sessionId: session._id.toString(),
      payload: hint.toJSON()
    });

    res.status(200).json({ success: true, data: hint });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const createTestCase = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id: questionId } = req.params;
    const { input, expectedOutput, isSample, status } = req.body;

    const question = await Question.findById(questionId);
    if (!question) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Question not found.' }
      });
      return;
    }

    const session = await Session.findById(question.sessionId);
    if (!session || !PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only interviewers can add test cases.' }
      });
      return;
    }

    const testCase = await TestCase.create({
      questionId,
      sessionId: session._id,
      input: input || '',
      expectedOutput: expectedOutput || '',
      isSample: !!isSample,
      status: status || 'HIDDEN'
    });

    res.status(201).json({ success: true, data: testCase });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const revealTestCase = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const testCase = await TestCase.findById(id);
    if (!testCase) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Test case not found.' }
      });
      return;
    }

    const session = await Session.findById(testCase.sessionId);
    if (!session || !PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only interviewers can reveal test cases.' }
      });
      return;
    }

    testCase.status = 'REVEALED';
    await testCase.save();

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'TESTCASE_REVEALED',
      resourceType: 'TESTCASE',
      resourceId: testCase._id.toString(),
      metadata: { isSample: testCase.isSample }
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'TESTCASE_REVEALED',
      sessionId: session._id.toString(),
      payload: testCase.toJSON()
    });

    res.status(200).json({ success: true, data: testCase });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const updateQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const id = String(req.params.id);
    const { title, description, difficulty, order, status } = req.body;

    const question = await Question.findById(id);
    if (!question) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Question not found.' }
      });
      return;
    }

    const session = await Session.findById(question.sessionId);
    if (!session || !PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only interviewers can update questions.' }
      });
      return;
    }

    if (title !== undefined) question.title = title;
    if (description !== undefined) question.description = description;
    if (difficulty !== undefined) question.difficulty = difficulty;
    if (order !== undefined) question.order = order;
    if (status !== undefined) question.status = status;

    await question.save();

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'QUESTION_UPDATED' as any,
      resourceType: 'QUESTION',
      resourceId: question._id.toString(),
      metadata: { title: question.title, status: question.status, difficulty: question.difficulty }
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'QUESTION_UPDATED',
      sessionId: session._id.toString(),
      payload: question.toJSON()
    });

    res.status(200).json({ success: true, data: question });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const deleteQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const id = String(req.params.id);

    const question = await Question.findById(id);
    if (!question) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Question not found.' }
      });
      return;
    }

    const session = await Session.findById(question.sessionId);
    if (!session || !PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only interviewers can delete questions.' }
      });
      return;
    }

    await Hint.deleteMany({ questionId: question._id });
    await TestCase.deleteMany({ questionId: question._id });
    await question.deleteOne();

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'QUESTION_DELETED' as any,
      resourceType: 'QUESTION',
      resourceId: question._id.toString(),
      metadata: { title: question.title }
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'QUESTION_DELETED',
      sessionId: session._id.toString(),
      payload: { questionId: id }
    });

    res.status(200).json({ success: true, data: { message: 'Question deleted.' } });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

