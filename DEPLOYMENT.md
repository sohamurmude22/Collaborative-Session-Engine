# 🚀 Production Deployment Guide: Vercel (Frontend) + Render (Backend) + MongoDB Atlas (Database)

This guide provides a comprehensive, beginner-friendly, step-by-step walkthrough for deploying the **Collaborative Session Engine (CSE)** using the recommended modern cloud architecture:

* **Frontend**: [Vercel](https://vercel.com) (Vite + React 18 + Monaco Editor on global Edge CDN)
* **Backend**: [Render](https://render.com) (Node.js + Express + Persistent WebSockets + Health Checks)
* **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas) (M0 Free Cloud Managed Database)

---

## 📋 Table of Contents
1. [Architecture & Why This Combination?](#-architecture--why-this-combination)
2. [Prerequisites](#-prerequisites)
3. [Phase 1: Set Up MongoDB Atlas (Cloud Database)](#-phase-1-set-up-mongodb-atlas-cloud-database)
4. [Phase 2: Deploy Backend on Render (Node.js + WebSockets)](#-phase-2-deploy-backend-on-render-nodejs--websockets)
   - [Option A: One-Click Deploy via Render Blueprint (`render.yaml`)](#option-a-one-click-deploy-via-render-blueprint-renderyaml)
   - [Option B: Manual Web Service Setup via Render Dashboard](#option-b-manual-web-service-setup-via-render-dashboard)
5. [Phase 3: Deploy Frontend on Vercel (React + Monaco Editor)](#-phase-3-deploy-frontend-on-vercel-react--monaco-editor)
6. [Phase 4: The 60-Second Handshake (Linking CORS)](#-phase-4-the-60-second-handshake-linking-cors)
7. [Phase 5: Seed the Cloud Database](#-phase-5-seed-the-cloud-database)
8. [Phase 6: Verification & Smoke Testing Checklist](#-phase-6-verification--smoke-testing-checklist)
9. [Phase 7: Error Diagnosis & Troubleshooting Matrix](#-phase-7-error-diagnosis--troubleshooting-matrix)

---

## 🏗️ Architecture & Why This Combination?

```
 ┌───────────────────────────────────────┐
 │            Vercel Edge CDN            │
 │     React 18 + Monaco Editor SPA      │
 │    https://your-app-name.vercel.app   │
 └──────────────────┬────────────────────┘
                    │
         HTTPS      │      WSS (Persistent WebSockets)
       REST API     │   Real-time presence & file locks
                    ▼
 ┌───────────────────────────────────────┐
 │           Render Web Service          │
 │       Node.js + Express + ws Engine   │
 │   https://cse-backend.onrender.com    │
 └──────────────────┬────────────────────┘
                    │
                    ▼ TLS Connection (Mongoose)
 ┌───────────────────────────────────────┐
 │             MongoDB Atlas             │
 │        M0 Free Cloud Database         │
 └───────────────────────────────────────┘
```

### Why This Architecture Works Best:
1. **Why Vercel for Frontend?**
   - **Zero Cold Starts**: Unlike static sites on some hosts, Vercel serves HTML, CSS, and JS from edge locations instantly.
   - **Built-in SPA Routing**: With our included `Communication/vercel.json`, refreshing `/sessions/CSE-DEMO26` or `/dashboard` will **never return a 404**.
   - **100% Free**: Unlimited bandwidth, free global SSL, and instantaneous Git deployments.
2. **Why Render for Backend?**
   - **Persistent WebSocket Server**: Vercel Serverless Functions do **not** support persistent bidirectional WebSockets. Render runs a long-lived Node.js process that keeps WebSockets (`ws`) connected indefinitely for live Monaco editing, real-time presence, and instant file locking.
   - **Zero-Downtime Health Checks**: Render pings `/api/health` before routing traffic to a new build.
   - **Interactive Web Shell**: Provides a built-in browser terminal to run database seed scripts with one command.
3. **Why MongoDB Atlas?**
   - Industry-standard managed cloud database with an M0 free tier, daily backups, and automated failover.

---

## 🧰 Prerequisites

Before starting, ensure you have:
1. A **GitHub** account with this repository pushed to your remote.
2. A free account on **[MongoDB Atlas](https://www.mongodb.com/atlas/database)**.
3. A free account on **[Render](https://render.com)** (sign up with GitHub).
4. A free account on **[Vercel](https://vercel.com)** (sign up with GitHub).

---

## 🍃 Phase 1: Set Up MongoDB Atlas (Cloud Database)

MongoDB Atlas will store user credentials, interview sessions, questions, code files, hints, test cases, and audit logs.

### Step 1.1: Create an M0 Free Cluster
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Click **Create** (or **Build a Database**).
3. Select the **M0 (Free)** tier.
4. Select a cloud provider and region (e.g., **AWS / us-east-1** or **AWS / eu-central-1**).
   *(Tip: Choose the region geographically closest to your Render service region to minimize query latency).*
5. Name your cluster (e.g., `Cluster0`) and click **Create**.

### Step 1.2: Create a Database User
1. In the left navigation menu under **Security**, click **Database Access**.
2. Click **Add New Database User**.
3. Configure the user:
   - **Authentication Method**: Password
   - **Username**: `cse_admin` (or your choice)
   - **Password**: Click **Autogenerate Secure Password** and copy it somewhere safe.
   - **Database User Privileges**: Select `Read and write to any database`.
4. Click **Add User**.

### Step 1.3: Whitelist Cloud IP Addresses (Mandatory)
Both Render and Vercel use dynamic outbound IP addresses. You must configure Atlas to allow connections from anywhere:
1. In the left navigation menu under **Security**, click **Network Access**.
2. Click **Add IP Address**.
3. Click **Allow Access from Anywhere** (this enters `0.0.0.0/0`).
4. Enter an optional comment (e.g., `Render and Cloud Access`).
5. Click **Confirm**.

### Step 1.4: Copy Your Connection URI
1. In the left navigation menu, click **Database**.
2. Click the **Connect** button on your cluster.
3. Choose **Drivers** (Node.js).
4. Copy the connection string:
   ```text
   mongodb+srv://cse_admin:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
5. **Format the URI**:
   - Replace `<db_password>` with your actual database user password from Step 1.2.
   - Insert the database name `collaborative-code-editor` immediately before the `?` query parameter:
   ```text
   mongodb+srv://cse_admin:MySecretPassword123@cluster0.abcde.mongodb.net/collaborative-code-editor?retryWrites=true&w=majority
   ```
   *(Keep this string handy for Phase 2).*

---

## 🚀 Phase 2: Deploy Backend on Render (Node.js + WebSockets)

You can deploy the backend using either **Option A (Render Blueprint - Easiest)** or **Option B (Manual Dashboard)**.

---

### Option A: One-Click Deploy via Render Blueprint (`render.yaml`)

This repository comes pre-configured with a root `render.yaml` file tailored for deploying the backend.

1. Ensure your repository is pushed to GitHub with `render.yaml` in the root.
2. Log in to the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** in the top navigation bar and select **Blueprint**.
4. Select your GitHub repository.
5. Render will automatically detect `render.yaml` and configure:
   - Service Name: `cse-backend`
   - Runtime: `node`
   - Plan: `free`
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npm start`
   - Health Check Path: `/api/health`
   - Auto-generated `JWT_SECRET` (256-bit secure key)
6. Render will prompt you for the uncommitted parameters marked `sync: false`:
   - **`MONGO_URI`**: Paste your full MongoDB Atlas connection string from Phase 1.
   - **`CLIENT_URL`**: Enter `http://localhost:5173` *(temporary placeholder; you will update this to your Vercel URL in Phase 4)*.
   - **`REDIS_URL`**: Leave blank *(the engine automatically falls back to high-performance in-memory pub/sub)*.
7. Click **Apply**. Render will build and deploy the backend service!

---

### Option B: Manual Web Service Setup via Render Dashboard

If you prefer configuring through the web interface:

1. In the [Render Dashboard](https://dashboard.render.com), click **New +** > select **Web Service**.
2. Select **Build and deploy from a Git repository** and connect your repo.
3. Configure the following fields:

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Name** | `cse-backend` | Or any unique name |
| **Language / Runtime** | `Node` | |
| **Region** | Oregon, Ohio, Frankfurt, or Singapore | Pick closest to your MongoDB Atlas region |
| **Branch** | `main` | Your default branch |
| **Root Directory** | *(Leave blank)* | |
| **Build Command** | `cd backend && npm install && npm run build` | Compiles TypeScript into `backend/dist` |
| **Start Command** | `cd backend && npm start` | Launches `node dist/server.js` |
| **Instance Type** | `Free` | |

4. Scroll down to **Advanced** > **Health Check Path** and enter:
   ```text
   /api/health
   ```
5. In the **Environment Variables** section, add the following key-value pairs:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security & optimizations |
| `MONGO_URI` | `mongodb+srv://cse_admin:pass@cluster0...` | Your Atlas connection URI from Phase 1 |
| `JWT_SECRET` | `any_secure_random_string_32_characters_long` | Token signing secret |
| `JWT_EXPIRES_IN` | `7d` | Token expiration duration |
| `CLIENT_URL` | `http://localhost:5173` | Temporary placeholder; updated in Phase 4 |

6. Click **Create Web Service**.

---

### Step 2.3: Verify Backend Startup & Copy Backend URL
1. Monitor the deployment logs in Render. Look for:
   ```text
   [CSE Server] Collaborative Session Engine Backend listening on port 10000 (0.0.0.0)
   [CSE Server] WebSocket endpoint available at: /ws
   [CSE Server] Health check available at: /api/health
   [Database] MongoDB Connected successfully
   ==> Health check passed for /api/health!
   ==> Your service is live 🚀
   ```
2. Copy your backend service URL displayed at the top of the Render page:
   ```text
   https://cse-backend.onrender.com
   ```
   *(Or with a random suffix, e.g.: `https://cse-backend-a1b2.onrender.com`).*
3. Test it in your browser by navigating to:
   ```text
   https://<your-backend-url>.onrender.com/api/health
   ```
   You should see:
   ```json
   {
     "success": true,
     "message": "Server is running",
     "database": "connected"
   }
   ```

---

## ⚡ Phase 3: Deploy Frontend on Vercel (React + Monaco Editor)

Vercel will host the Vite + React client on its global edge network with instant page loads and zero cold starts.

### Step 3.1: Import Project into Vercel
1. Log in to [Vercel.com](https://vercel.com) using your GitHub account.
2. From the Vercel dashboard, click **Add New...** > select **Project**.
3. Find your repository in the list and click **Import**.

### Step 3.2: Configure Monorepo Root Directory (Critical Step)
On the **Configure Project** screen:

1. **Framework Preset**: Verify it says **Vite** (Vercel will auto-detect).
2. **Root Directory**:
   - Click the **Edit** button next to **Root Directory**.
   - Select the **`Communication`** folder.
   - Click **Continue**.
3. **Build and Output Settings**:
   - Build Command: `npm run build` (leave default).
   - Output Directory: `dist` (leave default).
   - Install Command: `npm install` (leave default).

### Step 3.3: Set Frontend Environment Variables
Expand the **Environment Variables** section and add:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://<your-render-backend>.onrender.com/api` | Your Render backend URL ending in `/api` |
| `VITE_WS_URL` | `wss://<your-render-backend>.onrender.com/ws` | Your Render backend URL starting with `wss://` and ending in `/ws` |

> [!NOTE]
> Vite bakes `VITE_*` environment variables statically into the compiled JavaScript bundle at build time. Setting `VITE_API_URL` here ensures all API requests and WebSocket handshakes target your live Render server.

### Step 3.4: Deploy
1. Click **Deploy**.
2. Vercel will install dependencies, compile TypeScript, run Vite, and deploy your assets to the edge network in ~30 seconds.
3. Once finished, copy your live Vercel domain:
   ```text
   https://your-app-name.vercel.app
   ```

> [!TIP]
> This repository already contains `Communication/vercel.json` with rewrite rules (`/* -> /index.html`). This ensures refreshing routes like `/sessions/CSE-DEMO26` or `/dashboard` will **never throw a 404 error** on Vercel!

---

## 🔄 Phase 4: The 60-Second Handshake (Linking CORS)

Now that Vercel has generated your permanent frontend URL, update your Render backend's CORS whitelist so the browser allows communication:

1. Return to the **Render Dashboard** and open your **`cse-backend`** service.
2. Click the **Environment** tab in the left sidebar.
3. Find the `CLIENT_URL` variable.
4. Update its value to your live Vercel domain (**without trailing slash**):
   ```text
   CLIENT_URL=https://your-app-name.vercel.app
   ```
   *(To support local development simultaneously, separate with a comma: `http://localhost:5173,https://your-app-name.vercel.app`).*
5. Click **Save Changes**.
6. Render will automatically redeploy the backend with the updated CORS rule in under 1 minute.
7. **Frontend and backend are now securely linked!**

---

## 🌱 Phase 5: Seed the Cloud Database

Populate your MongoDB Atlas database with demo interviewers, candidates, coding questions, starter files, hints, and test cases:

### Option A: Via Render Web Shell (No Local Setup Required)
1. In the [Render Dashboard](https://dashboard.render.com), click on your **`cse-backend`** service.
2. In the left sidebar, click the **Shell** tab (opens an interactive terminal directly inside the running container).
3. Run:
   ```bash
   cd backend && npm run seed
   ```
4. Output will confirm:
   ```text
   [Seed] Connected to MongoDB database
   [Seed] Organization created: TechCorp Assessment Labs
   [Seed] Created User: interviewer@cse.com (Role: INTERVIEWER)
   [Seed] Created User: candidate@cse.com (Role: CANDIDATE)
   [Seed] Created User: admin@cse.com (Role: ADMIN)
   [Seed] Created Question: Longest Increasing Subsequence
   [Seed] Seeded questions, hints, and test cases successfully!
   ```

### Option B: From Your Local Machine Targeting Atlas
1. In your local `backend/.env` file, temporarily set `MONGO_URI` to your Atlas connection string.
2. Run from your local terminal:
   ```bash
   npm --prefix backend run seed
   ```

---

## 🔍 Phase 6: Verification & Smoke Testing Checklist

Run through this quick 2-minute checklist to ensure 100% operational success:

- [ ] **1. Health Endpoint**: Open `https://<backend>.onrender.com/api/health`. Confirm `{"success": true, "database": "connected"}`.
- [ ] **2. Frontend UI**: Open `https://<project-name>.vercel.app`. Verify the login screen renders styled with Tailwind CSS.
- [ ] **3. Authentication Smoke Test**: Click **Quick Fill: Interviewer** (`interviewer@cse.com` / `Interviewer123`), then click **Sign In**. Confirm you land on the dashboard with demo sessions.
- [ ] **4. Session Room**: Enter session `CSE-DEMO26`. Check that the Monaco Editor loads with C++ syntax highlighting and `main.cpp` appears in the file explorer.
- [ ] **5. WebSocket Real-Time Connection**: Open browser DevTools (**F12** > **Network** > **WS** filter). Confirm an active WebSocket connection with status `101 Switching Protocols` to `/ws`.
- [ ] **6. Permission Control**: Click **Lock** on `main.cpp` as Interviewer. In a separate private window logged in as Candidate, verify the editor immediately updates to **Locked (Read-Only)** in real time.
- [ ] **7. Progressive Reveal**: Click **Reveal Hint 1**. Confirm Hint 1 appears on the candidate's screen without refreshing.
- [ ] **8. SPA Routing on Refresh**: Refresh the page while inside `/sessions/CSE-DEMO26`. Confirm the session reloads cleanly without a 404 error.

---

## 🛠️ Phase 7: Error Diagnosis & Troubleshooting Matrix

If any part of the deployment runs into an issue, locate the symptom below for an immediate fix:

| # | Error / Symptom | Root Cause | Verified Solution |
| :---: | :--- | :--- | :--- |
| **1** | **CORS Error in Browser Console**<br>`Access to fetch at '...' from origin '...' has been blocked by CORS policy` | The backend `CLIENT_URL` does not match the Vercel domain, or contains a trailing slash. | In Render > `cse-backend` > **Environment**, update `CLIENT_URL` to match your Vercel URL **without trailing slash**:<br>`CLIENT_URL=https://your-app.vercel.app`<br>Render will automatically restart. |
| **2** | **Frontend calls `http://localhost:5000/api` in production**<br>`net::ERR_CONNECTION_REFUSED` | `VITE_API_URL` was not defined in Vercel before the build, so Vite fell back to localhost. | 1. In Vercel > **Settings** > **Environment Variables**, verify `VITE_API_URL=https://<backend>.onrender.com/api`.<br>2. Go to **Deployments** > click **...** on the latest deployment > select **Redeploy** (ensure build cache is cleared). |
| **3** | **404 Not Found on Page Refresh on Vercel**<br>Refreshing `/dashboard` or `/sessions/CSE-DEMO26` returns Vercel 404. | Single-Page Application (SPA) rewrite rule missing. | Ensure `Communication/vercel.json` exists in your repository with:<br>```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```<br>Commit and push to trigger an automatic Vercel redeploy. |
| **4** | **`MongooseServerSelectionError: connection timed out`**<br>Render backend logs crash on startup. | MongoDB Atlas IP whitelist is blocking Render's dynamic cloud IP. | In MongoDB Atlas > **Network Access**, ensure `0.0.0.0/0` (Allow Access from Anywhere) is active. Also check that your database user password in `MONGO_URI` is correct and special characters are URL-encoded. |
| **5** | **WebSocket fails or shows "Disconnected" badge**<br>`WebSocket connection to 'ws://...' failed: Mixed Content` | Using insecure `ws://` instead of secure `wss://` over HTTPS. | Set `VITE_WS_URL=wss://<backend>.onrender.com/ws` in Vercel environment variables. (CSE's `useSessionSocket` also automatically upgrades `https:` to `wss:`). |
| **6** | **Render Free Tier Spin-Down (50s Delay)**<br>App feels slow on first request after being idle. | Render free tier web services spin down after 15 minutes of inactivity. | **Free Solution**: Set up a free monitoring ping on [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) to ping `https://<backend>.onrender.com/api/health` every 10 minutes to keep the dyno warm. |
| **7** | **Vercel Build Error: `Could not resolve entry module`** | Root directory was not set to `Communication` in Vercel. | In Vercel > Project > **Settings** > **General**, change **Root Directory** to `Communication`, then redeploy. |
| **8** | **Health Check Timeout on `/api/health`**<br>Deployment hangs and rolls back on Render. | Server is either bound to `127.0.0.1` instead of `0.0.0.0`, or MongoDB connection is blocking startup. | Verify `backend/src/server.ts` uses `server.listen(PORT, '0.0.0.0')`. Ensure MongoDB Atlas whitelist is active so `connectDB()` does not block. |
| **9** | **Build Error: `JavaScript heap out of memory`**<br>`npm run build` fails during `tsc` compilation. | 512 MB Free tier memory limit exceeded during compilation. | Add an environment variable in Render:<br>`NODE_OPTIONS=--max-old-space-size=460`<br>This forces V8 garbage collection before reaching Render's memory threshold. |
| **10** | **Special Characters in Database Password Break URI** | Passwords containing `@`, `#`, `:`, `/`, or `?` corrupt connection string parsing. | URL-encode special characters in the password (e.g. `@` -> `%40`, `#` -> `%23`, `?` -> `%3F`) or autogenerate an alphanumeric password in Atlas. |

---

🎉 **Congratulations! Your Collaborative Session Engine is now deployed to production with Frontend on Vercel, Backend on Render, and Database on MongoDB Atlas!**
