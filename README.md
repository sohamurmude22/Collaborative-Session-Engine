# CSE — Collaborative Session Engine

> **"Collaborate in real time, while controlling and auditing access in real time."**

CSE is a production-style collaborative coding platform designed specifically for technical coding interviews, remote programming assessments, and monitored examination sessions.

Unlike conventional collaborative editors (Google Docs, Live Share, CodeShare), CSE gives the interviewer/examiner **strict dynamic, session-based access control** and **complete millisecond-precision audit replay capabilities**.

---

## Key Features

1. **Dedicated Permission Engine (`PermissionEngine`)**
   - Every file edit, code execution, view request, and reveal action is validated server-side.
   - Prevents candidate frontend tampering; returns HTTP 403 / WS error events on unauthorized attempts.
   - Automatic query projection scrubbing: candidates **never** receive hidden questions, hints, test cases, or confidential solutions in network responses.

2. **Dynamic File Matrix**
   - Instant file states: `VISIBLE_EDITABLE`, `VISIBLE_READONLY`, `LOCKED`, and `HIDDEN`.
   - Real-time lock/unlock: interviewer clicks **Lock** and candidate immediately loses edit privileges in Monaco Editor.

3. **Progressive Reveal Engine**
   - Interviewers can step-by-step reveal:
     - Problem Statements
     - Progressive algorithmic hints
     - Secret & sample test cases
     - Reference files

4. **Real-Time Collaboration & Presence**
   - Built on Monaco Editor, WebSockets (`ws`), and Redis Pub/Sub (with an automatic in-memory fallback).
   - Live presence tracking and bidirectional event broadcasts.

5. **Millisecond-Precision Audit & Suspicious Activity Detection**
   - Records all events: `SESSION_STARTED`, `FILE_LOCKED`, `FILE_UNLOCKED`, `QUESTION_REVEALED`, `CODE_RUN`, `PERMISSION_DENIED`, etc.
   - Flags suspicious activity events (e.g. `LARGE_PASTE` > 500 characters) for manual examiner inspection without arbitrary automated bans.

6. **Lock Timeline Replay**
   - Interactive replay player with Play, Pause, Next, Previous, Scrubber, and Variable Speed (`0.5x`, `1x`, `2x`, `4x`).
   - Reconstructs file permission states chronologically.

7. **Isolated Code Execution**
   - Sandboxed execution runner for **C++** (`g++`) and **Python** (`python3`) with execution timeouts and output buffer safeguards.

---

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Monaco Editor (`@monaco-editor/react`), Lucide Icons, Vite.
- **Backend**: Node.js, Express, TypeScript, WebSockets (`ws`), MongoDB with Mongoose, Redis Pub/Sub (with in-memory fallback), JWT authentication, bcrypt.
- **Tools**: Docker & Docker Compose, child_process runner.

---

## Quick Start & Running Locally

### Prerequisites
- Node.js (v18+)
- MongoDB running locally (`mongodb://127.0.0.1:27017`)
- (Optional) Redis running locally (`redis://127.0.0.1:6379`)
- C++ (`g++`) or Python installed on PATH for code execution.

### 1. Install Dependencies
```bash
# In backend
cd backend
npm install

# In frontend (Communication)
cd ../Communication
npm install
```

### 2. Seed Demo Data
Populates the database with demo users, a Longest Increasing Subsequence session, initial files (`main.cpp`, `solution.cpp`, `tests.cpp`, `README.md`), hints, and test cases:
```bash
cd backend
npx tsx src/scripts/seed.ts
```

### 3. Run Security Tests
```bash
cd backend
npx tsx src/scripts/testPermissions.ts
```

### 4. Run Both Backend & Frontend
Open two terminals or use root concurrently:

**Terminal 1 (Backend - Port 5000 & WS):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend - Port 5173):**
```bash
cd Communication
npm run dev
```

Visit: `http://localhost:5173`

---

## ☁️ Cloud Deployment (Render)

This repository is fully configured for deployment on **[Render](https://render.com)**.

For detailed step-by-step instructions (including free MongoDB Atlas setup, environment variables, WebSockets/WSS configuration, and 1-click Blueprints), refer to:

👉 **[RENDER_DEPLOYMENT.md](file:///c:/Users/Soham/OneDrive/Desktop/Mini%20Project/RENDER_DEPLOYMENT.md)**

### Quick Summary of Render Deployment Options:
- **Option 1 (Decoupled - Recommended)**: Deploy Backend as a Render Web Service (`backend`) and Frontend as a Render Static Site (`Communication`) for free CDN hosting.
- **Option 2 (Blueprint - 1-Click)**: Connect your repository and deploy with the bundled `render.yaml`.
- **Option 3 (Unified All-in-One)**: Deploy a single Web Service running `npm run build:all` and `npm start` where Express serves both API, WebSockets, and the compiled frontend.

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| **Interviewer** | `interviewer@cse.com` | `Interviewer123` |
| **Candidate** | `candidate@cse.com` | `Candidate123` |
| **System Admin** | `admin@cse.com` | `Admin123` |

*The login page also provides one-click demo login buttons for instant access.*

---

## Demo Flow Walkthrough

1. **Login as Interviewer**: Log in with `interviewer@cse.com` / `Interviewer123`.
2. **Access Session**: Click on "Senior Systems Engineer: Dynamic Programming Assessment" (`CSE-DEMO26`).
3. **Open Candidate in Private Tab**: In an Incognito window, go to `http://localhost:5173/login`, click **Candidate** quick-fill, and join session `CSE-DEMO26`.
4. **Observe Real-Time Matrix**:
   - The candidate sees only `main.cpp` and `README.md`. Notice `solution.cpp` and `tests.cpp` are completely hidden.
   - Both users see real-time presence.
5. **Lock File**:
   - On the Interviewer screen, click **Lock** next to `main.cpp`.
   - The candidate's Monaco Editor immediately displays the locked badge, and keyboard edits are disabled.
6. **Progressive Reveal**:
   - On the Interviewer screen, click **Reveal** on **Hint 1**.
   - Hint 1 instantly appears on the Candidate screen in real time without refreshing.
7. **Run Code**:
   - Candidate clicks **Run Code** on `main.cpp`. C++ compiles and executes, returning stdout in the terminal output panel.
8. **Timeline Replay**:
   - Interviewer navigates to `/sessions/:id/replay` to scrub, play, and view reconstructed permission states over time.
