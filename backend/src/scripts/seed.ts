import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { Session } from '../models/Session.js';
import { File } from '../models/File.js';
import { Question } from '../models/Question.js';
import { Hint } from '../models/Hint.js';
import { TestCase } from '../models/TestCase.js';
import { AuditLog } from '../models/AuditLog.js';
import { SessionParticipant } from '../models/SessionParticipant.js';

const seed = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/collaborative-code-editor';

  try {
    await mongoose.connect(mongoURI);
    console.log('[Seed] Connected to MongoDB');

    // Clean existing data for clean demo
    await User.deleteMany({});
    await Organization.deleteMany({});
    await Session.deleteMany({});
    await File.deleteMany({});
    await Question.deleteMany({});
    await Hint.deleteMany({});
    await TestCase.deleteMany({});
    await AuditLog.deleteMany({});
    await SessionParticipant.deleteMany({});

    console.log('[Seed] Cleared existing data');

    // 1. Create Organization
    const org = await Organization.create({
      name: 'Tech Interview Inc',
      slug: 'tech-interview',
      ownerId: new mongoose.Types.ObjectId()
    });

    // 2. Create Users
    const interviewer = await User.create({
      name: 'Sarah Interviewer',
      email: 'interviewer@cse.com',
      password: 'Interviewer123',
      role: 'INTERVIEWER',
      organizationId: org._id
    });

    const candidate = await User.create({
      name: 'Alex Candidate',
      email: 'candidate@cse.com',
      password: 'Candidate123',
      role: 'CANDIDATE',
      organizationId: org._id
    });

    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@cse.com',
      password: 'Admin123',
      role: 'ADMIN',
      organizationId: org._id
    });

    org.ownerId = admin._id;
    await org.save();

    console.log('[Seed] Created demo users: Interviewer, Candidate, Admin');

    // 3. Create Demo Session
    const sessionCode = 'CSE-DEMO26';
    const session = await Session.create({
      title: 'Senior Systems Engineer: Dynamic Programming Assessment',
      description: 'Find the Longest Increasing Subsequence in optimal O(N log N) time.',
      interviewerId: interviewer._id,
      candidateId: candidate._id,
      organizationId: org._id,
      status: 'ACTIVE',
      sessionCode,
      startedAt: new Date()
    });

    console.log(`[Seed] Created demo session: ${session.title} (${sessionCode})`);

    // 4. Create Initial Files with specified permissions
    // main.cpp -> VISIBLE_EDITABLE
    await File.create({
      sessionId: session._id,
      name: 'main.cpp',
      language: 'cpp',
      permission: 'VISIBLE_EDITABLE',
      content: `#include <iostream>
#include <vector>
#include <algorithm>

// Task: Implement longestIncreasingSubsequence(nums)
int longestIncreasingSubsequence(const std::vector<int>& nums) {
    if (nums.empty()) return 0;
    
    // TODO: Candidate implement O(n log n) patient sorting / binary search algorithm
    std::vector<int> tails;
    for (int x : nums) {
        auto it = std::lower_bound(tails.begin(), tails.end(), x);
        if (it == tails.end()) {
            tails.push_back(x);
        } else {
            *it = x;
        }
    }
    return tails.size();
}

int main() {
    std::vector<int> sample = {10, 9, 2, 5, 3, 7, 101, 18};
    int ans = longestIncreasingSubsequence(sample);
    std::cout << "LIS Length: " << ans << std::endl;
    return 0;
}
`
    });

    // solution.cpp -> HIDDEN
    await File.create({
      sessionId: session._id,
      name: 'solution.cpp',
      language: 'cpp',
      permission: 'HIDDEN',
      content: `// CONFIDENTIAL REFERENCE SOLUTION
#include <vector>
#include <algorithm>

int optimalLIS(const std::vector<int>& nums) {
    std::vector<int> dp;
    for (int num : nums) {
        auto it = std::lower_bound(dp.begin(), dp.end(), num);
        if (it == dp.end()) dp.push_back(num);
        else *it = num;
    }
    return dp.size();
}
`
    });

    // tests.cpp -> HIDDEN
    await File.create({
      sessionId: session._id,
      name: 'tests.cpp',
      language: 'cpp',
      permission: 'HIDDEN',
      content: `// Confidential Examiner Verification Suite
#include <cassert>
#include <vector>

void runTests() {
    // Hidden edge cases: duplicates, strictly decreasing sequences
    std::vector<int> test1 = {7, 7, 7, 7, 7};
    // Expected output: 1
}
`
    });

    // README.md -> VISIBLE_READONLY
    await File.create({
      sessionId: session._id,
      name: 'README.md',
      language: 'python',
      permission: 'VISIBLE_READONLY',
      content: `# Longest Increasing Subsequence Assessment

## Problem Description
Given an integer array \`nums\`, return the length of the longest strictly increasing subsequence.

### Constraints:
- 1 <= nums.length <= 2500
- -10^4 <= nums[i] <= 10^4

### Follow Up:
Can you derive an algorithm that runs in **O(n log n)** time complexity?
`
    });

    console.log('[Seed] Created files: main.cpp, solution.cpp, tests.cpp, README.md');

    // 5. Create Progressive Reveal Question
    const question = await Question.create({
      sessionId: session._id,
      title: 'Find the Longest Increasing Subsequence',
      description: 'Find the length of the longest strictly increasing subsequence in an array of integers. Focus on optimizing space and time complexity.',
      difficulty: 'HARD',
      status: 'REVEALED',
      order: 1
    });

    // Hints (Initially HIDDEN)
    await Hint.create({
      questionId: question._id,
      sessionId: session._id,
      title: 'Hint 1: Dynamic Programming State',
      content: 'Consider defining dp[i] as the length of the longest increasing subsequence ending with nums[i]. What is the recurrence relation?',
      status: 'HIDDEN',
      order: 1
    });

    await Hint.create({
      questionId: question._id,
      sessionId: session._id,
      title: 'Hint 2: Patient Sorting / Binary Search',
      content: 'Maintain an array `tails` where `tails[i]` stores the smallest tail of all increasing subsequences of length i+1. Notice `tails` is always sorted!',
      status: 'HIDDEN',
      order: 2
    });

    // Test cases (Sample is REVEALED, Secret is HIDDEN)
    await TestCase.create({
      questionId: question._id,
      sessionId: session._id,
      input: '[10,9,2,5,3,7,101,18]',
      expectedOutput: '4',
      isSample: true,
      status: 'REVEALED'
    });

    await TestCase.create({
      questionId: question._id,
      sessionId: session._id,
      input: '[0,1,0,3,2,3]',
      expectedOutput: '4',
      isSample: true,
      status: 'REVEALED'
    });

    await TestCase.create({
      questionId: question._id,
      sessionId: session._id,
      input: '[7,7,7,7,7,7,7]',
      expectedOutput: '1',
      isSample: false,
      status: 'HIDDEN'
    });

    console.log('[Seed] Created Question, Hints, and TestCases');

    // 6. Initial Audit Logs
    const now = Date.now();
    await AuditLog.create([
      {
        sessionId: session._id,
        actorId: interviewer._id,
        actorName: interviewer.name,
        actorRole: interviewer.role,
        eventType: 'SESSION_CREATED',
        resourceType: 'SESSION',
        resourceId: session._id,
        metadata: { title: session.title, code: sessionCode },
        timestamp: now - 3600000
      },
      {
        sessionId: session._id,
        actorId: interviewer._id,
        actorName: interviewer.name,
        actorRole: interviewer.role,
        eventType: 'SESSION_STARTED',
        resourceType: 'SESSION',
        resourceId: session._id,
        metadata: { status: 'ACTIVE' },
        timestamp: now - 3500000
      },
      {
        sessionId: session._id,
        actorId: candidate._id,
        actorName: candidate.name,
        actorRole: candidate.role,
        eventType: 'USER_JOINED',
        resourceType: 'SESSION',
        resourceId: session._id,
        metadata: { name: candidate.name },
        timestamp: now - 3000000
      }
    ]);

    console.log('[Seed] Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error during seeding:', err);
    process.exit(1);
  }
};

seed();
