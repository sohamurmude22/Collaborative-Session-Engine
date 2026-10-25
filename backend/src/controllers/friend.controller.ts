import { Response } from 'express';
import crypto from 'crypto';
import { User, IUserModel } from '../models/User.js';
import { Session } from '../models/Session.js';
import { SessionParticipant } from '../models/SessionParticipant.js';
import { File } from '../models/File.js';
import { Question } from '../models/Question.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export const getFriends = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const user = await User.findById(currentUser._id).populate<{ friends: IUserModel[] }>(
      'friends',
      'id name email role createdAt'
    );

    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found' } });
      return;
    }

    res.status(200).json({
      success: true,
      friends: user.friends || []
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const query = String(req.query.q || '').trim();

    if (!query) {
      res.status(200).json({ success: true, users: [] });
      return;
    }

    const regex = new RegExp(query, 'i');
    const users = await User.find({
      _id: { $ne: currentUser._id },
      $or: [{ name: regex }, { email: regex }]
    })
      .select('id name email role createdAt')
      .limit(20);

    res.status(200).json({
      success: true,
      users
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const addFriend = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const { email, userId } = req.body;

    if (!email && !userId) {
      res.status(400).json({
        success: false,
        error: { message: 'Friend email or userId is required.' }
      });
      return;
    }

    let targetUser: IUserModel | null = null;
    if (userId) {
      targetUser = await User.findById(userId);
    } else if (email) {
      targetUser = await User.findOne({ email: email.trim().toLowerCase() });
    }

    if (!targetUser) {
      res.status(404).json({
        success: false,
        error: { message: 'User not found.' }
      });
      return;
    }

    if (targetUser._id.toString() === currentUser._id.toString()) {
      res.status(400).json({
        success: false,
        error: { message: 'Cannot add yourself as a friend.' }
      });
      return;
    }

    const currentDoc = await User.findById(currentUser._id);
    if (!currentDoc) {
      res.status(404).json({ success: false, error: { message: 'Current user not found.' } });
      return;
    }

    const friendIdStrs = (currentDoc.friends || []).map((f: any) =>
      f._id ? f._id.toString() : f.toString()
    );

    if (friendIdStrs.includes(targetUser._id.toString())) {
      res.status(400).json({
        success: false,
        error: { message: 'This user is already in your friends list.' }
      });
      return;
    }

    // Reciprocal friendship
    if (!currentDoc.friends) currentDoc.friends = [];
    currentDoc.friends.push(targetUser._id);
    await currentDoc.save();

    if (!targetUser.friends) targetUser.friends = [];
    const targetFriendIdStrs = (targetUser.friends || []).map((f: any) =>
      f._id ? f._id.toString() : f.toString()
    );
    if (!targetFriendIdStrs.includes(currentUser._id.toString())) {
      targetUser.friends.push(currentUser._id);
      await targetUser.save();
    }

    const updatedUser = await User.findById(currentUser._id).populate<{ friends: IUserModel[] }>(
      'friends',
      'id name email role createdAt'
    );

    res.status(200).json({
      success: true,
      message: `Added ${targetUser.name} as a friend.`,
      friends: updatedUser?.friends || []
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const removeFriend = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const { id } = req.params;

    const targetUser = await User.findById(id);
    const currentDoc = await User.findById(currentUser._id);

    if (!currentDoc) {
      res.status(404).json({ success: false, error: { message: 'User not found.' } });
      return;
    }

    // Pull from both users
    await User.findByIdAndUpdate(currentUser._id, {
      $pull: { friends: id }
    });

    if (targetUser) {
      await User.findByIdAndUpdate(targetUser._id, {
        $pull: { friends: currentUser._id }
      });
    }

    const updatedUser = await User.findById(currentUser._id).populate<{ friends: IUserModel[] }>(
      'friends',
      'id name email role createdAt'
    );

    res.status(200).json({
      success: true,
      message: 'Friend removed successfully.',
      friends: updatedUser?.friends || []
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const startSessionWithFriend = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const { friendId, title, language } = req.body;

    if (!friendId) {
      res.status(400).json({ success: false, error: { message: 'friendId is required.' } });
      return;
    }

    const friend = await User.findById(friendId);
    if (!friend) {
      res.status(404).json({ success: false, error: { message: 'Friend not found.' } });
      return;
    }

    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const sessionCode = `CSE-${randomHex}`;

    const sessionTitle =
      title || `Collab Room: ${currentUser.name.split(' ')[0]} & ${friend.name.split(' ')[0]}`;

    const session = await Session.create({
      title: sessionTitle,
      description: `Collaborative study and interview session between ${currentUser.name} and ${friend.name}.`,
      interviewerId: currentUser._id,
      candidateId: friend._id,
      organizationId: currentUser.organizationId,
      status: 'ACTIVE',
      sessionCode,
      startedAt: new Date()
    });

    // Add both participants
    await SessionParticipant.create({
      sessionId: session._id,
      userId: currentUser._id,
      role: currentUser.role,
      status: 'ONLINE',
      lastSeen: Date.now()
    });

    await SessionParticipant.create({
      sessionId: session._id,
      userId: friend._id,
      role: 'CANDIDATE',
      status: 'OFFLINE',
      lastSeen: Date.now()
    });

    // Create starter file
    const lang = language || 'python';
    const ext = lang === 'python' ? 'py' : lang === 'javascript' ? 'js' : lang === 'typescript' ? 'ts' : 'cpp';
    const defaultContent =
      lang === 'python'
        ? `# Collaborative Session with ${friend.name}\n\ndef solve():\n    print("Welcome to your collaborative session!")\n\nif __name__ == '__main__':\n    solve()\n`
        : `// Collaborative Session with ${friend.name}\nfunction solve() {\n  console.log("Welcome to your collaborative session!");\n}\nsolve();\n`;

    await File.create({
      sessionId: session._id,
      name: `main.${ext}`,
      language: lang,
      content: defaultContent,
      permission: 'VISIBLE_EDITABLE'
    });

    // Create starter question
    await Question.create({
      sessionId: session._id,
      title: 'Pair Programming & Problem Solving',
      description: 'Collaborate with your partner to design, code, and test your solution here.',
      difficulty: 'MEDIUM',
      order: 1,
      status: 'REVEALED'
    });

    res.status(201).json({
      success: true,
      message: 'Session created and friend invited.',
      session: session.toJSON(),
      sessionCode
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
