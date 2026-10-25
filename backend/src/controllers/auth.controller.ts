import { Request, Response } from 'express';
import { User, DEFAULT_AVATAR } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { sendTokenResponse } from '../utils/token.js';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, dob, interests } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please provide name, email, and password.'
        }
      });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'An account with this email already exists.'
        }
      });
      return;
    }

    const userRole = role && ['ADMIN', 'INTERVIEWER', 'CANDIDATE'].includes(role) ? role : 'CANDIDATE';

    // Parse interests if passed as comma separated string or array
    let interestsList: string[] = [];
    if (Array.isArray(interests)) {
      interestsList = interests.map((i) => String(i).trim()).filter(Boolean);
    } else if (typeof interests === 'string' && interests.trim()) {
      interestsList = interests.split(',').map((s) => s.trim()).filter(Boolean);
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: userRole,
      avatarUrl: DEFAULT_AVATAR,
      dob: dob ? String(dob).trim() : '',
      interests: interestsList
    });

    sendTokenResponse(user, 201, res);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Server error during registration.'
      }
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please provide email and password.'
        }
      });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.'
        }
      });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.'
        }
      });
      return;
    }

    sendTokenResponse(user, 200, res);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Server error during login.'
      }
    });
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: { message: 'Logged out successfully.' }
  });
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not authenticated.'
      }
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user._id.toString(),
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        avatarUrl: req.user.avatarUrl || '',
        dob: req.user.dob || '',
        interests: req.user.interests || [],
        organizationId: req.user.organizationId?.toString()
      }
    }
  });
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } });
      return;
    }

    const { name, avatarUrl, dob, interests } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
      return;
    }

    if (name && typeof name === 'string' && name.trim()) {
      user.name = name.trim();
    }
    if (avatarUrl !== undefined && typeof avatarUrl === 'string') {
      user.avatarUrl = avatarUrl.trim();
    }
    if (dob !== undefined && typeof dob === 'string') {
      user.dob = dob.trim();
    }
    if (interests !== undefined) {
      if (Array.isArray(interests)) {
        user.interests = interests.map((i) => String(i).trim()).filter(Boolean);
      } else if (typeof interests === 'string') {
        user.interests = interests.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl || '',
          dob: user.dob || '',
          interests: user.interests || [],
          organizationId: user.organizationId?.toString()
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message || 'Error updating profile.' }
    });
  }
};

