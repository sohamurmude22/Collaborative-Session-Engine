import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { File } from '../models/File.js';
import { PermissionEngine } from '../permissions/PermissionEngine.js';

async function runTests() {
  console.log('--- STARTING CSE PERMISSION & SECURITY TESTS ---');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/collaborative-code-editor');

  const interviewer = await User.findOne({ email: 'interviewer@cse.com' });
  const candidate = await User.findOne({ email: 'candidate@cse.com' });
  const session = await Session.findOne({ sessionCode: 'CSE-DEMO26' });

  if (!interviewer || !candidate || !session) {
    throw new Error('Test preconditions failed: seed data not found.');
  }

  const mainCpp = await File.findOne({ sessionId: session._id, name: 'main.cpp' });
  const solutionCpp = await File.findOne({ sessionId: session._id, name: 'solution.cpp' });
  const readmeMd = await File.findOne({ sessionId: session._id, name: 'README.md' });

  if (!mainCpp || !solutionCpp || !readmeMd) {
    throw new Error('Test preconditions failed: files not found.');
  }

  // 1. Candidate can view editable file
  const canViewMain = PermissionEngine.canViewFile(candidate, session, mainCpp);
  console.assert(canViewMain.allowed === true, 'TEST 1 FAILED: Candidate should view main.cpp');
  console.log('✅ TEST 1 PASSED: Candidate can view main.cpp (VISIBLE_EDITABLE)');

  // 2. Candidate CANNOT view hidden file
  const canViewSolution = PermissionEngine.canViewFile(candidate, session, solutionCpp);
  console.assert(canViewSolution.allowed === false, 'TEST 2 FAILED: Candidate should NOT view hidden solution.cpp');
  console.log('✅ TEST 2 PASSED: Candidate cannot view solution.cpp (HIDDEN)');

  // 3. Interviewer CAN view hidden file
  const interviewerCanViewSolution = PermissionEngine.canViewFile(interviewer, session, solutionCpp);
  console.assert(interviewerCanViewSolution.allowed === true, 'TEST 3 FAILED: Interviewer must view hidden file');
  console.log('✅ TEST 3 PASSED: Interviewer can view solution.cpp');

  // 4. Candidate can edit VISIBLE_EDITABLE file
  const canEditMain = PermissionEngine.canEditFile(candidate, session, mainCpp);
  console.assert(canEditMain.allowed === true, 'TEST 4 FAILED: Candidate should edit main.cpp');
  console.log('✅ TEST 4 PASSED: Candidate can edit main.cpp');

  // 5. Candidate CANNOT edit VISIBLE_READONLY file
  const canEditReadme = PermissionEngine.canEditFile(candidate, session, readmeMd);
  console.assert(canEditReadme.allowed === false, 'TEST 5 FAILED: Candidate should NOT edit README.md');
  console.log('✅ TEST 5 PASSED: Candidate cannot edit README.md (READONLY)');

  // 6. Test File Lock
  mainCpp.permission = 'LOCKED';
  const canEditLocked = PermissionEngine.canEditFile(candidate, session, mainCpp);
  console.assert(canEditLocked.allowed === false, 'TEST 6 FAILED: Candidate should NOT edit locked file');
  console.log('✅ TEST 6 PASSED: Candidate is blocked when file is LOCKED');

  // 7. Interviewer can still edit locked file
  const interviewerEditLocked = PermissionEngine.canEditFile(interviewer, session, mainCpp);
  console.assert(interviewerEditLocked.allowed === true, 'TEST 7 FAILED: Interviewer should edit locked file');
  console.log('✅ TEST 7 PASSED: Interviewer retains edit privileges on locked file');

  // 8. Revert lock
  mainCpp.permission = 'VISIBLE_EDITABLE';

  console.log('--- ALL 8 PERMISSION ENGINE SECURITY TESTS PASSED ---');
  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
