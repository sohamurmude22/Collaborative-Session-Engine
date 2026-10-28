# 🚀 Production Deployment Guide: Vercel + Railway + MongoDB Atlas

This guide provides a comprehensive, beginner-friendly, step-by-step walkthrough for deploying the **Collaborative Session Engine (CSE)** to a modern production cloud architecture:

* **Frontend**: [Vercel](https://vercel.com) (Vite + React + Monaco Editor on global Edge CDN)
* **Backend**: [Railway](https://railway.app) (Node.js + Express + Persistent WebSockets + Sandboxed Code Runner)
* **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas) (Managed Cloud Database)

---

## 📋 Table of Contents
1. [Architecture & Why This Stack?](#-architecture--why-this-stack)
2. [Prerequisites](#-prerequisites)
3. [Phase 1: Set Up MongoDB Atlas (Cloud Database)](#-phase-1-set-up-mongodb-atlas-cloud-database)
4. [Phase 2: Deploy Backend to Railway (API & WebSockets)](#-phase-2-deploy-backend-to-railway-api--websockets)
5. [Phase 3: Deploy Frontend to Vercel (React + Monaco Editor)](#-phase-3-deploy-frontend-to-vercel-react--monaco-editor)
6. [Phase 4: The 60-Second Handshake (Linking CORS)](#-phase-4-the-60-second-handshake-linking-cors)
7. [Phase 5: Seed the Cloud Database](#-phase-5-seed-the-cloud-database)
8. [Phase 6: Verification & Smoke Testing Checklist](#-phase-6-verification--smoke-testing-checklist)
9. [Phase 7: Error Diagnosis & Troubleshooting Matrix](#-phase-7-error-diagnosis--troubleshooting-matrix)

---

## 🏗️ Architecture & Why This Stack?

```
 ┌────────────────────────┐         ┌────────────────────────┐
 │     Vercel Edge CDN    │         │    Railway Container   │
 │   (React + Monaco SPA) │◄───────►│  (Express + WebSockets)│
 │ https://app.vercel.app │   WSS   │ https://app.railway.app│
 └────────────────────────┘  HTTPS  └───────────┬────────────┘
                                                │
                                                ▼ Mongoose (TLS)
                                    ┌────────────────────────┐
                                    │     MongoDB Atlas      │
                                    │  (M0 Free Cloud DB)    │
                                    └────────────────────────┘
```

| Component | Host Platform | Why It's Best | Cost |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Vercel** | Lightning-fast global CDN, instant deployments, automatic SSL, zero cold starts. | 100% Free |
| **Backend** | **Railway** | Persistent containers (no 15-minute sleep/spin-down like Render free tier), seamless native WebSocket (`ws`) support, Nixpacks environment for compiling C++ and Python code. | Free / Pay-as-you-go |
| **Database** | **MongoDB Atlas** | Managed cloud replica set, automatic backups, high availability. | 100% Free (M0) |

---

## 🧰 Prerequisites

Before starting, ensure you have:
1. A **GitHub** account with this repository pushed to your personal account or organization.
2. A free account on **[MongoDB Atlas](https://www.mongodb.com/atlas/database)**.
3. A free account on **[Railway](https://railway.app)** (sign in with your GitHub account).
4. A free account on **[Vercel](https://vercel.com)** (sign in with your GitHub account).

---

## 🍃 Phase 1: Set Up MongoDB Atlas (Cloud Database)

MongoDB Atlas will store user accounts, interview sessions, questions, code files, hints, test cases, and audit logs.

### Step 1.1: Create an M0 Free Cluster
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. In the dashboard, click **Create** (or **Build a Database**).
3. Select the **M0 (Free)** tier.
4. Choose a cloud provider and region closest to your Railway deployment (e.g., **AWS / us-east-1** or **AWS / eu-west-1**).
5. Name your cluster (e.g., `Cluster0`) and click **Create**.

### Step 1.2: Create a Database User
1. In the left navigation sidebar under **Security**, click **Database Access**.
2. Click **Add New Database User**.
3. Configure the user:
   - **Authentication Method**: Password
   - **Username**: `cse_admin` (or your choice)
   - **Password**: Click **Autogenerate Secure Password** and copy it somewhere safe (e.g., in a temporary Notepad file).
   - **Database User Privileges**: Select `Read and write to any database`.
4. Click **Add User**.

### Step 1.3: Whitelist Cloud IP Addresses (Mandatory)
Cloud hosting platforms (Railway and Vercel) use dynamic outbound IP addresses. You must allow traffic from anywhere:
1. In the left navigation sidebar under **Security**, click **Network Access**.
2. Click **Add IP Address**.
3. Click **Allow Access from Anywhere** (this enters `0.0.0.0/0`).
4. Enter an optional comment (e.g., `Railway and Cloud Access`).
5. Click **Confirm**.

### Step 1.4: Obtain Your Connection String
1. In the left navigation sidebar, click **Database**.
2. Click the **Connect** button on your cluster.
3. Select **Drivers** (Node.js).
4. Copy the connection string. It will look like:
   ```text
   mongodb+srv://cse_admin:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
5. **Format the URI**:
   - Replace `<db_password>` with your actual password from Step 1.2.
   - Insert the database name `collaborative-code-editor` immediately before the `?` query parameter:
   ```text
   mongodb+srv://cse_admin:MySuperSecret123@cluster0.abcde.mongodb.net/collaborative-code-editor?retryWrites=true&w=majority
   ```
   *(Keep this string handy for Phase 2).*

---

## 🚂 Phase 2: Deploy Backend to Railway (API & WebSockets)

Railway will host the Express REST API, long-lived WebSockets server, and the code execution engine.

### Step 2.1: Create a New Project on Railway
1. Log in to [Railway.app](https://railway.app) using your GitHub account.
2. From the dashboard, click **New Project** (or **+ New**).
3. Select **Deploy from GitHub repo**.
4. Choose your repository from the list (e.g., `your-username/Mini-Project` or `Collaborative-Session-Engine`).
5. Click **Deploy Now**.

### Step 2.2: Configure Monorepo Settings (Root Directory)
Since this repository is a monorepo containing both `backend` and `Communication`:
1. In your Railway project canvas, click on the newly created service.
2. Go to the **Settings** tab.
3. Scroll down to the **Source** section:
   - Look for **Root Directory**.
   - Click **Edit** and set it to:
     ```text
     /backend
     ```
   - Click the checkmark to save.
4. Scroll down to the **Deploy** section:
   - Verify **Build Command** is empty or set to:
     ```bash
     npm run build
     ```
   - Verify **Start Command** is empty or set to:
     ```bash
     npm start
     ```
   - Set **Healthcheck Path** to:
     ```text
     /api/health
     ```

> [!TIP]
> This repository already includes `backend/railway.json` and `backend/nixpacks.toml`. Railway will automatically detect Node.js, run `npm run build` (`tsc`), install `gcc` (g++) and `python3` for sandboxed code execution, and probe `/api/health`.

### Step 2.3: Set Backend Environment Variables
1. While still on your backend service in Railway, click on the **Variables** tab.
2. Click **New Variable** (or **RAW Editor**) and add the following:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations and security |
| `MONGO_URI` | `mongodb+srv://cse_admin:password@cluster0...` | Your full Atlas connection URI from Phase 1 |
| `JWT_SECRET` | `generate_any_secure_random_string_32_chars` | Secret key for signing session tokens |
| `JWT_EXPIRES_IN` | `7d` | Token expiration duration |
| `CLIENT_URL` | `http://localhost:5173` | Temporary value; will update with Vercel URL in Phase 4 |
| `REDIS_URL` | *(Leave empty)* | Built-in in-memory pub/sub handles scaling automatically |

*(Note: You do NOT need to set `PORT`. Railway automatically injects `PORT` into the environment, and `server.ts` is already coded to read `process.env.PORT`).*

### Step 2.4: Generate a Public Domain
1. In your backend service, go to the **Settings** tab.
2. Scroll to the **Networking** section.
3. Under **Public Networking**, click **Generate Domain**.
4. Railway will generate a public URL like:
   ```text
   https://cse-backend-production.up.railway.app
   ```
5. **Copy this URL!** You will need it to configure Vercel in Phase 3.

### Step 2.5: Verify Backend Logs & Health Check
1. Go to the **Deployments** tab and click on the active deployment to view build and runtime logs.
2. You should see:
   ```text
   [CSE Server] Collaborative Session Engine Backend listening on port 5000 (0.0.0.0)
   [CSE Server] WebSocket endpoint available at: /ws
   [CSE Server] Health check available at: /api/health
   [Database] MongoDB Connected successfully: cluster0...
   ```
3. Open your browser and visit:
   ```text
   https://your-backend-url.up.railway.app/api/health
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

## ⚡ Phase 3: Deploy Frontend to Vercel (React + Monaco Editor)

Vercel will host the compiled Vite + React Single-Page Application (SPA) on its global edge network.

### Step 3.1: Import Repository into Vercel
1. Log in to [Vercel.com](https://vercel.com) using your GitHub account.
2. From the Vercel dashboard, click **Add New...** > **Project**.
3. Locate your repository in the list and click **Import**.

### Step 3.2: Configure Vercel Project Settings (Critical)
In the **Configure Project** screen, configure the monorepo path:

1. **Project Name**: `collaborative-session-engine` (or your choice).
2. **Framework Preset**: Verify it says **Vite** (Vercel will auto-detect).
3. **Root Directory**:
   - Click the **Edit** button next to **Root Directory**.
   - Select the **`Communication`** folder.
   - Click **Continue**.
4. **Build and Output Settings**:
   - Build Command: `npm run build` (default - leave as is).
   - Output Directory: `dist` (default - leave as is).
   - Install Command: `npm install` (default - leave as is).

### Step 3.3: Set Frontend Environment Variables
Expand the **Environment Variables** section and add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://your-backend.up.railway.app/api` | Your live Railway backend URL from Step 2.4, ending in `/api` |
| `VITE_WS_URL` | `wss://your-backend.up.railway.app/ws` | Your live Railway WebSocket endpoint starting with `wss://` and ending in `/ws` |

> [!NOTE]
> Vite bakes `VITE_*` environment variables statically into the JavaScript bundle at build time. Setting `VITE_API_URL` here ensures all API requests and WebSocket handshakes target your live Railway server.

### Step 3.4: Deploy
1. Click the **Deploy** button.
2. Vercel will install dependencies, compile TypeScript, run Vite, and deploy your assets to the edge network.
3. Once finished, you will see confetti and a preview of your app!
4. Copy your live Vercel domain:
   ```text
   https://your-app-name.vercel.app
   ```

> [!TIP]
> This repository already contains `Communication/vercel.json` with rewrite rules (`/* -> /index.html`). This ensures refreshing pages with client-side React routes like `/sessions/CSE-DEMO26` or `/dashboard` will **never return a 404 error**!

---

## 🔄 Phase 4: The 60-Second Handshake (Linking CORS)

Now that Vercel has generated your permanent frontend domain, link it back to your Railway backend so cross-origin requests (CORS) and cookies are permitted:

1. Return to your **Railway Dashboard** and click on your backend service.
2. Go to the **Variables** tab.
3. Find the `CLIENT_URL` variable.
4. Update its value to your live Vercel domain (without any trailing slash):
   ```text
   CLIENT_URL=https://your-app-name.vercel.app
   ```
   *(To support local development at the same time, you can provide comma-separated values: `http://localhost:5173,https://your-app-name.vercel.app`).*
5. Railway will automatically redeploy your backend in under 10 seconds.
6. **Congratulations! The frontend and backend are now securely linked.**

---

## 🌱 Phase 5: Seed the Cloud Database

Now populate MongoDB Atlas with initial demo users, organizations, sample assessment sessions, coding problems, hints, and test cases.

You can seed your database in either of two quick ways:

### Option A: From Your Local Machine Targeting Atlas (Easiest)
1. Open your local project folder in your terminal.
2. In your local `.env` file inside `backend/.env`, set `MONGO_URI` to your Atlas connection string:
   ```env
   MONGO_URI=mongodb+srv://cse_admin:password@cluster0.abcde.mongodb.net/collaborative-code-editor?retryWrites=true&w=majority
   ```
3. Run the seed script:
   ```bash
   npm --prefix backend run seed
   ```
4. Output will confirm:
   ```text
   [Seed] Connected to MongoDB database
   [Seed] Organization created: TechCorp Assessment Labs
   [Seed] Created User: interviewer@cse.com (Role: INTERVIEWER)
   [Seed] Created User: candidate@cse.com (Role: CANDIDATE)
   [Seed] Created User: admin@cse.com (Role: ADMIN)
   [Seed] Seeded questions, hints, and test cases successfully!
   ```

### Option B: Using the Railway CLI
If you have the Railway CLI installed on your computer (`npm i -g @railway/cli`):
```bash
railway link
railway run npm run seed
```

---

## 🔍 Phase 6: Verification & Smoke Testing Checklist

Run through this quick 2-minute checklist to verify the full stack:

- [ ] **1. Health Check Endpoint**: Open `https://your-backend.up.railway.app/api/health` in your browser. Confirm `{"success": true, "database": "connected"}`.
- [ ] **2. Frontend UI**: Open `https://your-app-name.vercel.app`. Verify the login screen renders styled with Tailwind CSS.
- [ ] **3. Authentication Test**: Click **Quick Fill: Interviewer** (`interviewer@cse.com` / `Interviewer123`), then click **Sign In**. Confirm you land on the dashboard.
- [ ] **4. Session Room**: Enter the demo session (`CSE-DEMO26`). Check that the Monaco Editor loads with code highlighting and the file list displays `main.cpp`.
- [ ] **5. WebSocket Real-Time Presence**: Open the browser Developer Tools (**F12** > **Network** > **WS** filter). Confirm an active WebSocket connection with status `101 Switching Protocols` to `/ws`.
- [ ] **6. Permission Control**: Click **Lock** on `main.cpp` as Interviewer. In a separate incognito window logged in as Candidate, observe the editor immediately show the **Locked (Read-Only)** badge in real time.
- [ ] **7. Progressive Reveal**: Click **Reveal Hint 1**. Confirm Hint 1 instantly displays on the candidate's screen.
- [ ] **8. Cloud Code Execution**: Click **Run Code** on `main.cpp`. Confirm C++ compiles and returns execution output in the terminal output tab.

---

## 🛠️ Phase 7: Error Diagnosis & Troubleshooting Matrix

If any part of the deployment runs into an issue, locate the symptom below for an immediate fix:

| # | Error / Symptom | Root Cause | Verified Solution |
| :---: | :--- | :--- | :--- |
| **1** | **CORS Error in Browser Console**<br>`Access to fetch at '...' from origin '...' has been blocked by CORS policy` | The backend `CLIENT_URL` does not match the Vercel domain, or contains a trailing slash. | In Railway > **Variables**, update `CLIENT_URL` to match your Vercel URL **without trailing slash**:<br>`CLIENT_URL=https://your-app.vercel.app`<br>Railway will automatically restart. |
| **2** | **Frontend calls `http://localhost:5000/api`**<br>`net::ERR_CONNECTION_REFUSED` | `VITE_API_URL` was not defined in Vercel before the build, so Vite fell back to localhost. | 1. In Vercel > **Settings** > **Environment Variables**, set `VITE_API_URL=https://your-backend.up.railway.app/api`.<br>2. Go to **Deployments** > click **...** on the latest deployment > select **Redeploy**. |
| **3** | **404 Not Found on Page Refresh on Vercel**<br>Refreshing `/dashboard` or `/sessions/CSE-DEMO26` returns Vercel 404. | Single-Page Application (SPA) rewrite rule missing. | Ensure `Communication/vercel.json` exists in your repository with:<br>```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```<br>Commit and push to trigger an automatic Vercel redeploy. |
| **4** | **`MongooseServerSelectionError: connection timed out`**<br>Railway backend crashes on boot. | MongoDB Atlas IP whitelist is blocking Railway's dynamic cloud IP. | In MongoDB Atlas > **Network Access**, ensure `0.0.0.0/0` (Allow Access from Anywhere) is active. Also check that your database user password in `MONGO_URI` is correct and special characters are URL-encoded. |
| **5** | **WebSocket fails or shows "Disconnected" badge**<br>`WebSocket connection to 'ws://...' failed: Mixed Content` | Using insecure `ws://` instead of secure `wss://` over HTTPS. | Set `VITE_WS_URL=wss://your-backend.up.railway.app/ws` in Vercel environment variables. (CSE's `useSessionSocket` also automatically upgrades `https:` to `wss:`). |
| **6** | **Railway Build Error: Cannot find module in monorepo** | Railway built from root instead of `backend/`. | In Railway > Service > **Settings** > **Source**, set **Root Directory** to `/backend`. |
| **7** | **Code Execution returns `g++: not found` or `python3: not found`** | Compiler/runtime binaries missing in cloud container. | Ensure `backend/nixpacks.toml` exists with:<br>```toml
[phases.setup]
nixPkgs = ["...", "gcc", "python3"]
```<br>Railway's Nixpacks builder will automatically install `gcc` and `python3` into the container image. |
| **8** | **Railway Healthcheck Failed**<br>Deployment times out after 120 seconds. | Server failed to bind to `0.0.0.0` or MongoDB took too long to connect. | Verify `backend/src/server.ts` uses `const PORT = Number(process.env.PORT) || 5000` and binds to `0.0.0.0`. Ensure MongoDB Atlas whitelist is active so `connectDB()` does not block. |

---

🎉 **Congratulations! Your Collaborative Session Engine is now deployed to production on Vercel and Railway with MongoDB Atlas!**
