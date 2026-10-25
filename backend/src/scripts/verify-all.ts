import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import app from '../app.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import http from 'http';

const PORT = 5055;
let server: http.Server;

const BASE_URL = `http://127.0.0.1:${PORT}/api`;

interface CookieJar {
  cookie?: string;
}

// Helper to make fetch requests and track cookies
async function request(
  endpoint: string,
  options: RequestInit = {},
  jar?: CookieJar
): Promise<{ status: number; body: any; headers: Headers }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (jar?.cookie) {
    headers['Cookie'] = jar.cookie;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie && jar) {
    // Extract token=... part
    const match = setCookie.match(/token=[^;]+/);
    if (match) {
      jar.cookie = match[0];
    } else if (setCookie.includes('token=;')) {
      jar.cookie = undefined;
    }
  }

  let body: any;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: res.status, body, headers: res.headers };
}

async function runTests() {
  console.log('=== Starting Verification of All 18+ Test Cases ===\n');

  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/collaborative-code-editor';
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB for testing.');

  // Clean test collections
  await User.deleteMany({ email: /test.*@example\.com/ });
  await Session.deleteMany({ title: /Test Session/ });

  // Start HTTP server on test port
  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}\n`);
      resolve();
    });
  });

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, name: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${name}`, detail || '');
      failedCount++;
    }
  }

  try {
    // 0. Health check endpoint
    const healthRes = await request('/health');
    assert(healthRes.status === 200 && healthRes.body.success === true && healthRes.body.database === 'connected', '0. Health check /api/health works and reports database connected');

    // 1. Register new user (Candidate)
    const candEmail = `test.candidate.${Date.now()}@example.com`;
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Candidate User',
        email: candEmail,
        password: 'password123'
      })
    });
    assert(
      regRes.status === 201 &&
      regRes.body.success === true &&
      regRes.body.user.role === 'CANDIDATE' &&
      regRes.body.user.password === undefined,
      '1. Register new user as CANDIDATE (Safe info returned, no password)'
    );

    // 2. Duplicate email rejected
    const dupRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Candidate Clone',
        email: candEmail,
        password: 'password123'
      })
    });
    assert(dupRes.status === 409 && dupRes.body.success === false, '2. Duplicate email rejected with 409 Conflict');

    // 3. Password is hashed in MongoDB
    const rawUserInDb = await User.findOne({ email: candEmail }).select('+password');
    assert(
      rawUserInDb !== null &&
      rawUserInDb.password !== 'password123' &&
      rawUserInDb.password!.startsWith('$2'),
      '3. Password is securely hashed in MongoDB via bcrypt'
    );

    // 4. Login with correct password
    const candJar: CookieJar = {};
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: candEmail,
        password: 'password123'
      })
    }, candJar);
    assert(
      loginRes.status === 200 &&
      loginRes.body.success === true &&
      loginRes.body.user.email === candEmail &&
      candJar.cookie !== undefined &&
      candJar.cookie.includes('token='),
      '4. Login with correct password (HTTP-only JWT cookie received)'
    );

    // 5. Wrong password rejected
    const wrongPassRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: candEmail,
        password: 'wrongpassword'
      })
    });
    assert(wrongPassRes.status === 401 && wrongPassRes.body.success === false, '5. Wrong password rejected with 401');

    // 6. JWT authentication & /api/auth/me works
    const meRes = await request('/auth/me', { method: 'GET' }, candJar);
    assert(
      meRes.status === 200 &&
      meRes.body.success === true &&
      meRes.body.user.email === candEmail &&
      meRes.body.user.role === 'CANDIDATE',
      '6. GET /api/auth/me verifies JWT cookie and returns authenticated user'
    );

    // 7. Refresh keeps user logged in (simulated by re-fetching /me with same cookie)
    const refreshRes = await request('/auth/me', { method: 'GET' }, candJar);
    assert(refreshRes.status === 200 && refreshRes.body.user.id === regRes.body.user.id, '7. Subsequent requests with cookie keep user logged in');

    // 8. Logout works
    const logoutRes = await request('/auth/logout', { method: 'POST' }, candJar);
    const afterLogoutRes = await request('/auth/me', { method: 'GET' }, candJar);
    assert(
      logoutRes.status === 200 &&
      afterLogoutRes.status === 401,
      '8. Logout clears cookie; protected routes reject user afterward'
    );

    // 9. Protected route rejects unauthenticated user
    const unauthSessionRes = await request('/sessions', { method: 'GET' });
    assert(unauthSessionRes.status === 401, '9. Protected /api/sessions route rejects unauthenticated user');

    // Setup Interviewer & Admin accounts for role test
    const intEmail = `test.interviewer.${Date.now()}@example.com`;
    const intUser = new User({
      name: 'Interviewer Alice',
      email: intEmail,
      password: 'password123',
      role: 'INTERVIEWER'
    });
    await intUser.save();

    const adminEmail = `test.admin.${Date.now()}@example.com`;
    const adminUser = new User({
      name: 'Admin Bob',
      email: adminEmail,
      password: 'password123',
      role: 'ADMIN'
    });
    await adminUser.save();

    const intJar: CookieJar = {};
    await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: intEmail, password: 'password123' })
    }, intJar);

    const adminJar: CookieJar = {};
    await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: 'password123' })
    }, adminJar);

    // Log candidate back in
    await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: candEmail, password: 'password123' })
    }, candJar);

    // 10. Candidate cannot create session
    const candCreateRes = await request('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Session Candidate',
        language: 'javascript'
      })
    }, candJar);
    assert(candCreateRes.status === 403, '10. Candidate cannot create session (403 Forbidden)');

    // 11. Interviewer can create session
    const intCreateRes = await request('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Session Two Sum Interview',
        description: 'Solve two sum in O(n)',
        language: 'cpp'
      })
    }, intJar);
    assert(
      intCreateRes.status === 201 &&
      intCreateRes.body.success === true &&
      intCreateRes.body.session.status === 'WAITING' &&
      intCreateRes.body.session.createdBy.email === intEmail,
      '11. Interviewer can create session (status=WAITING, createdBy set by server)'
    );
    const sessionId = intCreateRes.body.session.id;

    // 12. Admin can create session
    const adminCreateRes = await request('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Session Admin Exam',
        language: 'python'
      })
    }, adminJar);
    assert(adminCreateRes.status === 201 && adminCreateRes.body.success === true, '12. Admin can create session');

    // 13. User can join session
    const joinRes = await request(`/sessions/${sessionId}/join`, { method: 'POST' }, candJar);
    assert(
      joinRes.status === 200 &&
      joinRes.body.success === true &&
      joinRes.body.session.participants.some((p: any) => p.email === candEmail),
      '13. User (Candidate) can join session (added to participants)'
    );

    // 14. User can leave session
    const leaveRes = await request(`/sessions/${sessionId}/leave`, { method: 'POST' }, candJar);
    assert(
      leaveRes.status === 200 &&
      leaveRes.body.success === true &&
      !leaveRes.body.session.participants.some((p: any) => p.email === candEmail),
      '14. User can leave session (removed from participants, session preserved)'
    );

    // Candidate joins back for lifecycle testing
    await request(`/sessions/${sessionId}/join`, { method: 'POST' }, candJar);

    // 15. Unauthorized user cannot start/end another user's session
    const unauthStartRes = await request(`/sessions/${sessionId}/start`, { method: 'POST' }, candJar);
    assert(unauthStartRes.status === 403, '15. Unauthorized user (Candidate) cannot start session (403 Forbidden)');

    // 16. Creator can start session
    const startRes = await request(`/sessions/${sessionId}/start`, { method: 'POST' }, intJar);
    assert(
      startRes.status === 200 &&
      startRes.body.session.status === 'ACTIVE' &&
      startRes.body.session.startedAt !== undefined,
      '16. Creator can start session (status transitions WAITING -> ACTIVE, startedAt recorded)'
    );

    // Cannot restart already active session
    const restartRes = await request(`/sessions/${sessionId}/start`, { method: 'POST' }, intJar);
    assert(restartRes.status === 400, '16b. Cannot start an already ACTIVE session (400)');

    // 17. Creator can end session
    const endRes = await request(`/sessions/${sessionId}/end`, { method: 'POST' }, intJar);
    assert(
      endRes.status === 200 &&
      endRes.body.session.status === 'ENDED' &&
      endRes.body.session.endedAt !== undefined,
      '17. Creator can end session (status transitions ACTIVE -> ENDED, endedAt recorded)'
    );

    // 18. User cannot join ended session
    const otherCandJar: CookieJar = {};
    const otherCandEmail = `test.other.${Date.now()}@example.com`;
    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Other Candidate', email: otherCandEmail, password: 'password123' })
    });
    await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: otherCandEmail, password: 'password123' })
    }, otherCandJar);

    const joinEndedRes = await request(`/sessions/${sessionId}/join`, { method: 'POST' }, otherCandJar);
    assert(joinEndedRes.status === 400, '18. Users cannot join an ENDED session (400 Bad Request)');

    // 19. Session remains in MongoDB after ending
    const sessionInDb = await Session.findById(sessionId);
    assert(sessionInDb !== null && (sessionInDb.status as string) === 'COMPLETED', '19. Session remains persisted in MongoDB after ending');

  } catch (error) {
    console.error('Test execution error:', error);
    failedCount++;
  } finally {
    // Cleanup
    await User.deleteMany({ email: /test.*@example\.com/ });
    await Session.deleteMany({ title: /Test Session/ });
    await mongoose.disconnect();
    server.close();

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passedCount} Passed, ${failedCount} Failed`);
    console.log(`========================================\n`);

    if (failedCount > 0) {
      process.exit(1);
    }
  }
}

runTests();
