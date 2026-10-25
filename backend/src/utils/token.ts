import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { IUserModel } from '../models/User.js';

export const sendTokenResponse = (user: IUserModel, statusCode: number, res: Response): void => {
  const secret = process.env.JWT_SECRET || 'collaborative_session_engine_secret_jwt_key_2026';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  const token = jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role
    },
    secret,
    { expiresIn } as any
  );

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      data: {
        token,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl || '',
          organizationId: user.organizationId?.toString()
        }
      }
    });
};
