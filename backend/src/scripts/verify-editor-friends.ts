import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import app from '../app.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';

dotenv.config();

const PORT = 5058;
let server: http.Server;
const BASE_URL = `http://localhost:${PORT}/api`;

const makeRequest = async (
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    cookie?: string;
  } = {}
): Promise<{ status: number; data: any; setCookie: string | null }> => {
  const { method = 'GET', body, cookie } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const setCookie = res.headers.get('set-cookie');
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return {
    status: res.status,
    data,
    setCookie,
  };
};

async function runTests() {
  console.log('=== Starting Verification for Code Editor & Friends System ===\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/collaborative-session-db';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB for testing.');

  // Clean test accounts
  await User.deleteMany({ email: /@test-editor\.com$/ });
  await Session.deleteMany({ title: /Editor Test/ });

  server = app.listen(PORT);
  console.log(`Test server running on port ${PORT}\n`);

  try {
    // 1. Create two test students: Alice and Bob
    const aliceRes = await makeRequest('/auth/register', {
      method: 'POST',
      body: {
        name: 'Alice Student',
        email: 'alice@test-editor.com',
        password: 'password123',
      },
    });
    if (aliceRes.status !== 201) throw new Error(`Alice register failed: ${JSON.stringify(aliceRes.data)}`);
    console.log('[PASS] 1. Register Student Alice');

    const bobRes = await makeRequest('/auth/register', {
      method: 'POST',
      body: {
        name: 'Bob Peer',
        email: 'bob@test-editor.com',
        password: 'password123',
      },
    });
    if (bobRes.status !== 201) throw new Error(`Bob register failed: ${JSON.stringify(bobRes.data)}`);
    console.log('[PASS] 2. Register Student Bob');

    // 2. Login Alice and Bob
    const aliceLogin = await makeRequest('/auth/login', {
      method: 'POST',
      body: { email: 'alice@test-editor.com', password: 'password123' },
    });
    const aliceCookie = aliceLogin.setCookie || '';

    const bobLogin = await makeRequest('/auth/login', {
      method: 'POST',
      body: { email: 'bob@test-editor.com', password: 'password123' },
    });
    const bobCookie = bobLogin.setCookie || '';

    // 3. Search users
    const searchRes = await makeRequest('/friends/search?q=Bob', {
      cookie: aliceCookie,
    });
    if (searchRes.status !== 200 || !searchRes.data.users.length) {
      throw new Error(`Search failed: ${JSON.stringify(searchRes.data)}`);
    }
    console.log('[PASS] 3. Search registered classmates by query');

    // 4. Prevent adding self as friend
    const selfFriendRes = await makeRequest('/friends/add', {
      method: 'POST',
      body: { email: 'alice@test-editor.com' },
      cookie: aliceCookie,
    });
    if (selfFriendRes.status !== 400) {
      throw new Error(`Expected 400 when adding self, got ${selfFriendRes.status}`);
    }
    console.log('[PASS] 4. Rejects adding oneself as friend (400)');

    // 5. Add Bob as friend
    const addFriendRes = await makeRequest('/friends/add', {
      method: 'POST',
      body: { email: 'bob@test-editor.com' },
      cookie: aliceCookie,
    });
    if (addFriendRes.status !== 200 || addFriendRes.data.friends.length !== 1) {
      throw new Error(`Add friend failed: ${JSON.stringify(addFriendRes.data)}`);
    }
    console.log('[PASS] 5. Add classmate as friend (Study Buddy)');

    // 6. Prevent duplicate friend
    const dupFriendRes = await makeRequest('/friends/add', {
      method: 'POST',
      body: { email: 'bob@test-editor.com' },
      cookie: aliceCookie,
    });
    if (dupFriendRes.status !== 400) {
      throw new Error(`Expected 400 on duplicate friend, got ${dupFriendRes.status}`);
    }
    console.log('[PASS] 6. Rejects duplicate friend additions (400)');

    // 7. Verify reciprocal friendship for Bob
    const bobFriendsRes = await makeRequest('/friends', {
      cookie: bobCookie,
    });
    if (bobFriendsRes.status !== 200 || bobFriendsRes.data.friends.length !== 1) {
      throw new Error(`Reciprocal friend check failed: ${JSON.stringify(bobFriendsRes.data)}`);
    }
    console.log('[PASS] 7. Reciprocal friendship verified in peer friends list');

    // 8. Create an interviewer for creating coding session
    await User.create({
      name: 'Instructor Dr. Smith',
      email: 'instructor@test-editor.com',
      password: 'password123',
      role: 'INTERVIEWER',
    });
    const instructorLogin = await makeRequest('/auth/login', {
      method: 'POST',
      body: { email: 'instructor@test-editor.com', password: 'password123' },
    });
    const instructorCookie = instructorLogin.setCookie || '';

    // 9. Create a coding session with Python language
    const sessionRes = await makeRequest('/sessions', {
      method: 'POST',
      body: {
        title: 'Editor Test Room: Binary Search',
        description: 'Implement iterative binary search in Python',
        language: 'python',
      },
      cookie: instructorCookie,
    });
    if (sessionRes.status !== 201 || !sessionRes.data.session.code.includes('Python')) {
      throw new Error(`Session creation failed: ${JSON.stringify(sessionRes.data)}`);
    }
    const sessionId = sessionRes.data.session.id;
    console.log('[PASS] 8. Create session initialized with default language boilerplate');

    // 10. Student Alice joins session
    const joinRes = await makeRequest(`/sessions/${sessionId}/join`, {
      method: 'POST',
      cookie: aliceCookie,
    });
    if (joinRes.status !== 200) {
      throw new Error(`Join session failed: ${JSON.stringify(joinRes.data)}`);
    }
    console.log('[PASS] 9. Student joins session successfully');

    // 11. Student writes and saves code in the room
    const testCode = 'def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    return -1\n';
    const codeUpdateRes = await makeRequest(`/sessions/${sessionId}/code`, {
      method: 'PUT',
      body: { code: testCode },
      cookie: aliceCookie,
    });
    if (codeUpdateRes.status !== 200 || codeUpdateRes.data.code !== testCode) {
      throw new Error(`Code update failed: ${JSON.stringify(codeUpdateRes.data)}`);
    }
    console.log('[PASS] 10. Save and persist code in the room buffer via PUT /api/sessions/:id/code');

    // 12. Verify session GET retrieves updated room code
    const getSessionRes = await makeRequest(`/sessions/${sessionId}`, {
      cookie: bobCookie,
    });
    if (getSessionRes.status !== 200 || getSessionRes.data.session.code !== testCode) {
      throw new Error(`Session code fetch mismatch: ${JSON.stringify(getSessionRes.data)}`);
    }
    console.log('[PASS] 11. Other connected students retrieve the live updated code');

    // 13. Remove friend
    const bobId = bobRes.data.user.id;
    const removeFriendRes = await makeRequest(`/friends/${bobId}`, {
      method: 'DELETE',
      cookie: aliceCookie,
    });
    if (removeFriendRes.status !== 200 || removeFriendRes.data.friends.length !== 0) {
      throw new Error(`Remove friend failed: ${JSON.stringify(removeFriendRes.data)}`);
    }
    console.log('[PASS] 12. Remove friend from study buddies list');

    console.log('\n========================================');
    console.log('TEST SUMMARY: ALL 12 TESTS PASSED');
    console.log('========================================\n');
  } finally {
    // Cleanup
    await User.deleteMany({ email: /@test-editor\.com$/ });
    await Session.deleteMany({ title: /Editor Test/ });
    await mongoose.disconnect();
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
