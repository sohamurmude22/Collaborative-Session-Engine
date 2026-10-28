# 🚀 Deploying Collaborative Session Engine on Render

This guide provides a comprehensive, step-by-step walkthrough for deploying the **Collaborative Session Engine** (Full-stack TypeScript, Express, WebSockets, MongoDB, and Vite + React) to [Render](https://render.com).

---

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Set Up MongoDB Atlas (Free Cloud Database)](#step-1-set-up-mongodb-atlas-free-cloud-database)
4. [Deployment Method 1: Decoupled Services (Recommended)](#deployment-method-1-decoupled-services-recommended)
   - [Deploy Backend Web Service](#a-deploy-backend-web-service)
   - [Deploy Frontend Static Site (100% Free)](#b-deploy-frontend-static-site-100-free)
   - [Link Frontend to Backend CORS](#c-link-frontend-to-backend-cors)
5. [Deployment Method 2: Infrastructure as Code with `render.yaml` (Render Blueprint)](#deployment-method-2-infrastructure-as-code-with-renderyaml-render-blueprint)
   - [5.1 Deep Breakdown of `render.yaml` Directives](#51-deep-breakdown-of-renderyaml-directives)
   - [5.2 Step-by-Step Blueprint Deployment Walkthrough](#52-step-by-step-blueprint-deployment-walkthrough)
   - [5.3 The Two-Way Cross-Service URL Handshake (Critical)](#53-the-two-way-cross-service-url-handshake-critical)
   - [5.4 Database Seeding via Render Shell](#54-database-seeding-via-render-shell)
   - [5.5 Verification & Smoke Testing Checklist](#55-verification--smoke-testing-checklist)
   - [5.6 Check for Errors & Troubleshooting Matrix](#56-check-for-errors--troubleshooting-matrix)
6. [Deployment Method 3: All-in-One Single Service](#deployment-method-3-all-in-one-single-service)
7. [Database Seeding in Production](#database-seeding-in-production)
8. [Environment Variables Reference](#environment-variables-reference)
9. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## 🏗️ Architecture Overview

On Render, this project can be hosted in two optimal ways:

| Option | Frontend | Backend | Best For | Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Method 1 (Recommended)** | Render Static Site (Global CDN) | Render Web Service (Node.js + WebSockets) | Optimal performance & decoupled scaling | Free Tier eligible |
| **Method 2 (Blueprint)** | Automated via `render.yaml` | Automated via `render.yaml` | 1-Click Git-based infrastructure setup | Free Tier eligible |
| **Method 3 (Unified)** | Bundled inside Express (`Communication/dist`) | Render Web Service (Single container) | Lowest resource count; zero CORS setup | Free Tier eligible |

---

## 🧰 Prerequisites

Before beginning, ensure you have:
1. A **GitHub** or **GitLab** account with this repository pushed to your remote.
2. A free account on **[Render.com](https://render.com)**.
3. A free account on **[MongoDB Atlas](https://www.mongodb.com/atlas/database)** (Render does not offer built-in managed MongoDB on the free tier).

---

## 🍃 Step 1: Set Up MongoDB Atlas (Free Cloud Database)

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Click **Create** to launch an **M0 Free Cluster** (Shared). Choose your closest region (e.g., AWS / `us-east-1` or `eu-central-1`).
3. **Database Access (User Credentials)**:
   - Go to **Security** > **Database Access** > **Add New Database User**.
   - Authentication Method: **Password**.
   - Username: `cse_admin` (or your choice).
   - Password: Click **Autogenerate Secure Password** and copy it somewhere safe.
   - Database User Privileges: **Read and write to any database**.
   - Click **Add User**.
4. **Network Access (IP Whitelist)**:
   - Go to **Security** > **Network Access** > **Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`) — *this is mandatory because Render dynos have dynamic outbound IP addresses*.
   - Click **Confirm**.
5. **Get Connection String**:
   - Go to **Database** > Click **Connect** on your cluster.
   - Choose **Drivers** (Node.js).
   - Copy the SRV URI. It looks like:
     ```text
     mongodb+srv://cse_admin:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
     ```
   - Replace `<db_password>` with your actual database user password.
   - Specify the database name before the `?` query parameter:
     ```text
     mongodb+srv://cse_admin:MySecretPass123@cluster0.abcde.mongodb.net/collaborative-code-editor?retryWrites=true&w=majority
     ```

---

## 🚀 Deployment Method 1: Decoupled Services (Recommended)

### A. Deploy Backend Web Service

1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Click **New +** in the top navigation bar and select **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your repository.
4. Fill in the following configuration:

| Field | Value |
| :--- | :--- |
| **Name** | `cse-backend` (or your preferred name) |
| **Language / Runtime** | `Node` |
| **Region** | Select the region closest to your MongoDB Atlas cluster |
| **Branch** | `main` (or your active default branch) |
| **Root Directory** | `backend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

5. Scroll down to **Advanced** > **Health Check Path** and set:
   ```text
   /api/health
   ```
6. In the **Environment Variables** section, add the following key-value pairs:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations |
| `PORT` | `5000` | (Render will override or route automatically) |
| `MONGO_URI` | `mongodb+srv://...` | Your MongoDB Atlas connection string from Step 1 |
| `JWT_SECRET` | `generate_any_secure_random_string_32_chars` | Secret key for signing authentication tokens |
| `JWT_EXPIRES_IN` | `7d` | Token expiry duration |
| `CLIENT_URL` | `http://localhost:5173` | Temporary value; will update with frontend URL in step C |

7. Click **Create Web Service**. Wait for the build and deployment logs to say:
   ```text
   [CSE Server] Collaborative Session Engine Backend listening on port 5000 (0.0.0.0)
   [Database] MongoDB Connected successfully
   ```
8. Copy your backend service URL from the top of the page:
   ```text
   https://cse-backend.onrender.com
   ```

---

### B. Deploy Frontend Static Site (100% Free)

Render provides static site hosting with global CDN caching and free SSL certificates at no cost.

1. In the Render Dashboard, click **New +** and select **Static Site**.
2. Connect the same Git repository.
3. Fill in the following configuration:

| Field | Value |
| :--- | :--- |
| **Name** | `cse-frontend` |
| **Branch** | `main` |
| **Root Directory** | `Communication` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

4. Scroll down to **Advanced** > **Redirects / Rewrites** > click **Add Rule**:
   - **Type**: `Rewrite`
   - **Source**: `/*`
   - **Destination**: `/index.html`
   *(⚠️ Critical: This ensures client-side routes like `/session/:id` or `/dashboard` work when refreshed).*

5. In **Environment Variables**, add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://cse-backend.onrender.com/api` | Your backend API endpoint from Step A |
| `VITE_WS_URL` | `wss://cse-backend.onrender.com/ws` | Secure WebSocket endpoint (`wss://`) |

6. Click **Create Static Site**.
7. Once deployment finishes, your frontend will be live at:
   ```text
   https://cse-frontend.onrender.com
   ```

---

### C. Link Frontend to Backend CORS

Now that your frontend URL is live:
1. Return to your **Backend Web Service** (`cse-backend`) in Render.
2. Go to **Environment**.
3. Update the `CLIENT_URL` variable to your live frontend URL:
   ```text
   CLIENT_URL=https://cse-frontend.onrender.com
   ```
   *(Multiple URLs can be comma-separated: `http://localhost:5173,https://cse-frontend.onrender.com`).*
4. Render will automatically re-deploy your backend with the updated CORS rule.

---

## ⚡ Deployment Method 2: Infrastructure as Code with `render.yaml` (Render Blueprint)

A **Render Blueprint** (`render.yaml`) allows you to define, configure, and orchestrate your entire multi-service stack (Node.js API, WebSockets, static CDN frontend, health checks, routing, and environment parameters) in a single declarative Infrastructure-as-Code (IaC) file committed directly to your repository.

With Blueprints, you can spin up the complete Collaborative Session Engine with **one click** without manually configuring individual services, build commands, rewrite rules, or headers in the dashboard.

---

### 5.1 Deep Breakdown of `render.yaml` Directives

Here is the exact `render.yaml` included in the root of this repository, with an in-depth breakdown of every property:

```yaml
services:
  # ========================================================
  # Backend Web Service (Node.js + Express + WebSockets)
  # ========================================================
  - type: web
    name: cse-backend
    runtime: node
    plan: free
    region: oregon # or ohio, frankfurt, singapore
    buildCommand: cd backend && npm install && npm run build
    startCommand: cd backend && npm start
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGO_URI
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_EXPIRES_IN
        value: 7d
      - key: CLIENT_URL
        sync: false
      - key: REDIS_URL
        sync: false

  # ========================================================
  # Frontend Static Site (Vite + React + Monaco Editor)
  # Free hosting on Render's global CDN
  # ========================================================
  - type: web
    name: cse-frontend
    runtime: static
    buildCommand: cd Communication && npm install && npm run build
    staticPublishPath: ./Communication/dist
    pullRequestPreviewsEnabled: false
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    headers:
      - path: /*
        name: X-Frame-Options
        value: SAMEORIGIN
      - path: /assets/*
        name: Cache-Control
        value: public, max-age=31536000, immutable
    envVars:
      - key: VITE_API_URL
        sync: false
      - key: VITE_WS_URL
        sync: false
```

#### Why Each Property is Configured This Way:

| Section | Directive | Deep Explanation & Purpose |
| :--- | :--- | :--- |
| **Backend** | `type: web` & `runtime: node` | Provisions a dynamic Node.js container capable of handling long-lived HTTP and bidirectional WebSocket (`ws`) connections. |
| | `plan: free` | Uses Render's free tier (512 MB RAM, 0.1 CPU). |
| | `region: oregon` | Selects the data center region. Best practice: Choose the region geographically closest to your MongoDB Atlas cluster to minimize query latency. |
| | `buildCommand: cd backend && npm install && npm run build` | Navigates into the `backend` subdirectory, installs dependencies, and runs `tsc` to compile TypeScript into production JavaScript in `backend/dist`. |
| | `startCommand: cd backend && npm start` | Launches `node dist/server.js`, binding to `process.env.PORT` on `0.0.0.0` (all interfaces). |
| | `healthCheckPath: /api/health` | **Critical for Zero-Downtime**: Render repeatedly pings `GET /api/health` during deployment. Only when this endpoint returns an HTTP 200 (confirming Express is up and MongoDB is connected) does Render switch traffic to the new instance. |
| | `autoDeploy: true` | Automatically rebuilds and deploys the backend whenever new commits are pushed to the connected Git branch. |
| | `envVars -> sync: false` | Marks sensitive variables (`MONGO_URI`, `CLIENT_URL`) so they are **never hardcoded in Git**. Render will securely prompt you for these values in the UI during Blueprint setup. |
| | `envVars -> generateValue: true` | Instructs Render to automatically generate a cryptographically strong, 256-bit random string for `JWT_SECRET` upon first deployment. |
| **Frontend** | `type: web` & `runtime: static` | Deploys the Vite React app directly onto Render's Edge CDN network. Unlike web services, static sites on Render are **100% free forever, never spin down, and offer unlimited global bandwidth**. |
| | `buildCommand: cd Communication && npm install && npm run build` | Installs frontend dependencies and executes `tsc && vite build`, creating the minified client bundle. |
| | `staticPublishPath: ./Communication/dist` | Informs Render's CDN which directory contains the compiled `index.html`, CSS, JS chunks, and Monaco Editor web worker assets. |
| | `routes -> type: rewrite` | **Crucial for Single-Page Applications (React Router)**: Rewrites all inbound requests (`/*`) to `/index.html`. Without this, refreshing a route like `https://cse-frontend.onrender.com/sessions/CSE-DEMO26` will produce a 404 error. |
| | `headers -> X-Frame-Options: SAMEORIGIN` | Enforces clickjacking protection while allowing trusted same-origin framing. |
| | `headers -> Cache-Control: max-age=31536000, immutable` | Caches Vite-hashed assets (`/assets/*`) on user browsers and CDN edge caches for 1 year, guaranteeing maximum loading speed. |

---

### 5.2 Step-by-Step Blueprint Deployment Walkthrough

Follow these detailed steps to launch the complete stack using `render.yaml`:

#### Step 1: Push Repository with `render.yaml`
Ensure `render.yaml` is located in the **root directory** of your repository on GitHub or GitLab:
```bash
git add render.yaml
git commit -m "feat: configure Render blueprint for full-stack deployment"
git push origin main
```

#### Step 2: Ensure MongoDB Atlas Whitelist is Configured
Before deploying, make sure your MongoDB Atlas cluster accepts connections from Render:
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Navigate to **Security** > **Network Access**.
3. Confirm that `0.0.0.0/0` (Allow Access from Anywhere) is active. *(Render instances use dynamic outbound IPs; without `0.0.0.0/0`, backend connection will time out).*
4. Under **Database Access**, verify your database user has `readWriteAnyDatabase` privileges.
5. Copy your connection URI (e.g., `mongodb+srv://cse_admin:<password>@cluster0.abcde.mongodb.net/collaborative-code-editor?retryWrites=true&w=majority`).

#### Step 3: Initiate Blueprint in Render Dashboard
1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click the blue **New +** button in the top right corner.
3. Select **Blueprint** from the dropdown menu.
4. Search for and select your repository (`Collaborative-Session-Engine` or your repo name).
5. Give your Blueprint Instance a name (e.g., `cse-stack`).
6. Select your target branch (typically `main`).

#### Step 4: Configure Blueprint Environment Parameters
Render will parse `render.yaml` and present an input modal for all keys marked `sync: false`:

| Parameter | Service | Value to Enter |
| :--- | :--- | :--- |
| `MONGO_URI` | `cse-backend` | Your full MongoDB Atlas connection string (with password and database name). |
| `CLIENT_URL` | `cse-backend` | Enter `https://cse-frontend.onrender.com` (or temporary placeholder; you can update this after Render generates the exact domain). |
| `REDIS_URL` | `cse-backend` | *(Leave blank)* — The engine automatically falls back to the high-performance in-memory pub/sub adapter. |
| `VITE_API_URL` | `cse-frontend` | Enter `https://cse-backend.onrender.com/api` (or planned backend URL). |
| `VITE_WS_URL` | `cse-frontend` | *(Optional - can leave blank)* — The frontend `useSessionSocket` hook automatically derives the secure `wss://` URL from `VITE_API_URL`. |

> [!NOTE]
> `JWT_SECRET` is set to `generateValue: true` in `render.yaml`, so Render creates this secret automatically without requiring manual input.

#### Step 5: Click Apply & Monitor Live Deployment
1. Click **Apply**.
2. Render will immediately initiate parallel builds for both:
   - **`cse-backend`** (Web Service)
   - **`cse-frontend`** (Static Site)
3. Click on **`cse-backend`** to monitor the build logs:
   - Dependency installation: `npm install`
   - TypeScript compilation: `tsc`
   - Service startup: `cd backend && npm start`
   - Successful startup logs:
     ```text
     [CSE Server] Collaborative Session Engine Backend listening on port 10000 (0.0.0.0)
     [CSE Server] WebSocket endpoint available at: /ws
     [CSE Server] Health check available at: /api/health
     [Database] MongoDB Connected successfully
     ```
   - Health check confirmation:
     ```text
     ==> Health check passed for /api/health!
     ==> Your service is live 🚀
     ```
4. Click on **`cse-frontend`** to verify Vite compilation:
   - Output directory created: `./Communication/dist`
   - CDN assets uploaded and deployed.

---

### 5.3 The Two-Way Cross-Service URL Handshake (Critical)

In cloud deployments, there is a natural dependency between frontend and backend:
- The **Backend** needs the exact **Frontend URL** for its CORS whitelist (`CLIENT_URL`).
- The **Frontend** needs the exact **Backend URL** baked into its JavaScript bundle (`VITE_API_URL`).

Because Render assigns random suffixes to service names if the base name is already taken across global Render users (e.g., `cse-backend-a1b2.onrender.com` instead of `cse-backend.onrender.com`), perform this **2-minute post-deploy handshake**:

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Developer
    participant B as Backend Service (cse-backend)
    participant F as Frontend CDN (cse-frontend)

    Note over B,F: Initial Blueprint Deployment Completed
    Dev->>B: 1. Copy live Backend URL (e.g., https://cse-backend-xyz.onrender.com)
    Dev->>F: 2. Set VITE_API_URL = https://cse-backend-xyz.onrender.com/api
    Dev->>F: 3. Trigger "Manual Deploy > Clear build cache & deploy"
    Note over F: Vite rebuilds & bakes backend URL into bundle
    Dev->>F: 4. Copy live Frontend URL (e.g., https://cse-frontend-abc.onrender.com)
    Dev->>B: 5. Set CLIENT_URL = https://cse-frontend-abc.onrender.com
    Note over B: Backend auto-restarts with updated CORS origin
    Note over Dev,F: Full bidirectional communication established!
```

#### Step-by-Step Handshake Instructions:
1. **Verify Backend URL**:
   - Go to `cse-backend` in the Render dashboard and copy the URL at the top (e.g., `https://cse-backend-xyz.onrender.com`).
2. **Update Frontend Environment**:
   - Go to `cse-frontend` > **Environment**.
   - Set `VITE_API_URL` to `https://cse-backend-xyz.onrender.com/api`.
   - *(Optional)* Set `VITE_WS_URL` to `wss://cse-backend-xyz.onrender.com/ws`.
   - Click **Save Changes**.
   - Click **Manual Deploy** > **Clear build cache & deploy** *(⚠️ Mandatory: Vite bakes environment variables into static JS files at build time; clearing the cache ensures the new URL is baked into the compiled bundle).*
3. **Update Backend CORS**:
   - Go to `cse-backend` > **Environment**.
   - Set `CLIENT_URL` to your live frontend URL (e.g., `https://cse-frontend-abc.onrender.com`).
   - Click **Save Changes**. Render will automatically restart the backend service with the updated CORS policy.

---

### 5.4 Database Seeding via Render Shell

Once the backend is live and connected to MongoDB Atlas, populate the production database with demo interviewers, candidates, coding questions, starter files, hints, and test cases:

1. Open the [Render Dashboard](https://dashboard.render.com).
2. Click on the **`cse-backend`** service.
3. Click the **Shell** tab in the left sidebar (this opens an interactive terminal inside the running container).
4. Run the seed script:
   ```bash
   cd backend && npm run seed
   ```
5. Confirm the output:
   ```text
   [Seed] Connected to MongoDB database
   [Seed] Organization created: TechCorp Assessment Labs
   [Seed] Created User: interviewer@cse.com (Role: INTERVIEWER)
   [Seed] Created User: candidate@cse.com (Role: CANDIDATE)
   [Seed] Created User: admin@cse.com (Role: ADMIN)
   [Seed] Created Question: Longest Increasing Subsequence
   [Seed] Seeded questions, hints, and test cases successfully!
   ```

---

### 5.5 Verification & Smoke Testing Checklist

Run through this quick verification checklist to guarantee 100% operational success:

- [ ] **Health Endpoint Check**: Open `https://<your-backend>.onrender.com/api/health` in your browser. You should receive:
  ```json
  {
    "success": true,
    "message": "Server is running",
    "database": "connected"
  }
  ```
- [ ] **Frontend Loading**: Open your frontend URL (`https://<your-frontend>.onrender.com`). The login page should render with styled UI and demo quick-fill buttons.
- [ ] **Authentication Smoke Test**: Click **Quick Fill: Interviewer** (`interviewer@cse.com`), then click **Sign In**. You should be routed to the dashboard displaying active sessions.
- [ ] **Collaborative Room Test**: Enter the demo session (`CSE-DEMO26`). Check that the Monaco Editor loads syntax highlighting and the file list shows `main.cpp`.
- [ ] **WebSocket Connection**: Open browser DevTools (**F12** > **Network** > **WS** tab). Verify a green status `101 Switching Protocols` connection to `/ws`.
- [ ] **Permission Lock Test**: Click **Lock** on `main.cpp`. The editor status badge should immediately transition to **Locked (Read-Only)** in real time.

---

### 5.6 Check for Errors & Troubleshooting Matrix

If any step fails during deployment, locate the exact symptom in this troubleshooting matrix:

| # | Error / Symptom | Root Cause | Verified Solution |
| :---: | :--- | :--- | :--- |
| **1** | **`Invalid render.yaml: services[X] ...`**<br>Blueprint upload fails or gives a YAML syntax error. | Indentation error, tabs used instead of spaces, or unsupported fields. | • Verify YAML uses standard 2-space indentation (no tab characters).<br>• Ensure `type: web` is used for both services and `runtime: static` is specified for `cse-frontend`.<br>• Validate your YAML syntax locally with `npx yaml-lint render.yaml`. |
| **2** | **Frontend calls `http://localhost:5000/api` in production**<br>Console error: `net::ERR_CONNECTION_REFUSED`. | `VITE_API_URL` was empty or missing during the Vite build, causing the bundle to fall back to the localhost default. | • Go to `cse-frontend` > **Environment**.<br>• Set `VITE_API_URL=https://<your-backend-name>.onrender.com/api`.<br>• Click **Manual Deploy** > **Clear build cache & deploy** *(crucial: Vite cannot read runtime environment variables in the browser; it must recompile)*. |
| **3** | **CORS Error in Browser Console**<br>`Access to fetch at '...' from origin '...' has been blocked by CORS policy`. | The backend `CLIENT_URL` does not match the frontend domain, or contains a trailing slash. | • Check `cse-backend` > **Environment** > `CLIENT_URL`.<br>• Make sure it matches your frontend domain **without any trailing slash** (e.g. `https://cse-frontend.onrender.com`).<br>• To support both local testing and production, specify comma-separated origins:<br>`CLIENT_URL=http://localhost:5173,https://cse-frontend.onrender.com` |
| **4** | **404 Not Found on Page Refresh**<br>Refreshing `/sessions/CSE-DEMO26` or `/dashboard` returns Render 404 page. | Missing Single-Page Application (SPA) rewrite rule on the static site. | • Ensure `render.yaml` contains the `routes` rewrite block:<br>```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```<br>• If already deployed, verify under `cse-frontend` > **Redirects/Rewrites** that `/* -> /index.html` (Rewrite) is active. |
| **5** | **`MongooseServerSelectionError: connection timed out`**<br>Backend logs crash on startup. | MongoDB Atlas IP whitelist is blocking Render's dynamic IP addresses. | • In [MongoDB Atlas](https://cloud.mongodb.com/), go to **Network Access**.<br>• Click **Add IP Address** > select **Allow Access from Anywhere** (`0.0.0.0/0`).<br>• Verify password in `MONGO_URI` does not contain unescaped URL characters (replace `@` with `%40`, `#` with `%23`, etc.). |
| **6** | **WebSocket fails or shows "Disconnected" badge**<br>`WebSocket connection to 'ws://...' failed: Mixed Content`. | Attempting to connect via unencrypted `ws://` over an HTTPS production site. | • Browsers block plain `ws://` connections from HTTPS sites as insecure mixed content.<br>• Ensure `useSessionSocket` or `VITE_WS_URL` uses `wss://` (secure WebSockets).<br>• Example: `wss://<your-backend>.onrender.com/ws`. |
| **7** | **Build Error: `JavaScript heap out of memory`**<br>`npm run build` fails during `tsc` or Vite bundling. | Free tier memory limit (512 MB RAM) exceeded during simultaneous type checking and asset minification. | • Add an environment variable in the affected service:<br>`NODE_OPTIONS=--max-old-space-size=460`<br>• This instructs the V8 engine to trigger aggressive garbage collection before hitting Render's 512 MB memory boundary. |
| **8** | **Health Check Timeout on `/api/health`**<br>Deployment hangs and rolls back after 5 minutes. | Express server is either bound to `127.0.0.1` instead of `0.0.0.0`, or hardcoded to a port other than `process.env.PORT`. | • Verify `backend/src/server.ts` uses:<br>`const PORT = Number(process.env.PORT) || 5000;`<br>`server.listen(PORT, '0.0.0.0', ...)`<br>• Ensure `/api/health` does not perform slow blocking synchronous database calls before sending the response. |
| **9** | **Initial request takes 50+ seconds (Cold Start)**<br>App feels sluggish after being idle. | Free tier Render Web Services spin down automatically after 15 minutes of inactivity. | • This is expected on the Render Free Tier.<br>• **Free Solution**: Set up a free monitoring check on [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) to ping `https://<your-backend>.onrender.com/api/health` once every 10 minutes to keep the dyno warm. |
| **10** | **TypeScript Compiler Error TS2307 / TS2503 during build**<br>`Cannot find module ... or its corresponding type declarations`. | Submodule or monorepo dependency missing in isolated container. | • Ensure `package.json` in `backend` and `Communication` have all required dependencies under `dependencies` or `devDependencies` (never rely on global system packages).<br>• Verify casing on imports matches physical file names on Linux (Render uses Linux containers where filenames are case-sensitive). |

---

---

## 📦 Deployment Method 3: All-in-One Single Service

If you want to run everything (API, WebSockets, and Frontend UI) inside **a single Render service** to conserve free tier hours:

1. In Render, click **New +** > **Web Service**.
2. Connect your repository.
3. Configure:
   - **Root Directory**: *(Leave empty / root `.`)*
   - **Build Command**: `npm run build:all`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. In **Environment Variables**, add:
   - `NODE_ENV=production`
   - `MONGO_URI=mongodb+srv://...`
   - `JWT_SECRET=your_secret_key`
   - `CLIENT_URL=https://<your-service-name>.onrender.com`
5. The backend Express server will detect `Communication/dist`, automatically serve the compiled React SPA on the root domain, route `/api/*` to REST endpoints, and route `/ws` for collaborative WebSocket sessions.

---

## 🌱 Database Seeding in Production

To populate the production database with initial demo accounts, interview sessions, questions, and hints:

### Option A: Via Render Web Shell
1. Go to your backend Web Service in the Render Dashboard.
2. Click the **Shell** tab in the left sidebar.
3. Run:
   ```bash
   npm run seed
   ```
4. You will see:
   ```text
   [Seed] Connected to MongoDB database
   [Seed] Organization created: TechCorp Assessment Labs
   [Seed] Created User: interviewer@cse.io
   [Seed] Created User: candidate@cse.io
   [Seed] Seeded questions, hints, and test cases successfully!
   ```

### Option B: From Your Local Machine Targeting Atlas
1. In your local `.env` file inside `backend/.env`, temporarily set:
   ```env
   MONGO_URI=mongodb+srv://cse_admin:password@cluster0.abcde.mongodb.net/collaborative-code-editor?retryWrites=true&w=majority
   ```
2. Run from your terminal:
   ```bash
   npm --prefix backend run seed
   ```

---

## 🔑 Environment Variables Reference

### Backend Service (`backend`)

| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Configures production security and logging |
| `PORT` | Auto | `5000` / `10000` | Port listened by Express & HTTP server (Render sets automatically) |
| `MONGO_URI` | **Yes** | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` | MongoDB connection string |
| `JWT_SECRET` | **Yes** | `random_32_character_string` | Secret used to sign and verify session JWTs |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiration period |
| `CLIENT_URL` | **Yes** | `https://cse-frontend.onrender.com` | Allowed CORS origins (comma-separated if multiple) |
| `REDIS_URL` | No | *(Empty)* | Optional Redis pub/sub. If omitted, built-in in-memory fallback is used automatically. |

### Frontend Static Site (`Communication`)

| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `https://cse-backend.onrender.com/api` | REST API base URL |
| `VITE_WS_URL` | No | `wss://cse-backend.onrender.com/ws` | WebSocket endpoint. If omitted, frontend derives it automatically from `VITE_API_URL` |

---

## 🔍 Troubleshooting & FAQs

### 1. WebSocket connection fails or displays "Disconnected"
- **Cause**: Using plain `ws://` over an HTTPS site triggers browser mixed-content security restrictions.
- **Solution**: Ensure your frontend uses `wss://` (secure WebSocket) when connecting to Render. The updated `useSessionSocket.ts` hook automatically handles this conversion.
- Verify `VITE_WS_URL` is set to `wss://<backend-service>.onrender.com/ws`.

### 2. CORS Error (`Access to XMLHttpRequest has been blocked by CORS policy`)
- **Cause**: The backend `CLIENT_URL` does not match the frontend domain.
- **Solution**:
  1. Check the exact URL of your frontend (e.g., `https://cse-frontend.onrender.com`).
  2. In your backend Render environment settings, update `CLIENT_URL` to match (without trailing slash).
  3. You can supply multiple origins: `http://localhost:5173,https://cse-frontend.onrender.com`.

### 3. Page Refresh Returns 404 on Frontend
- **Cause**: Static hosts look for a matching HTML file on disk (e.g. `/session/123.html`) instead of delegating to the single page application (`index.html`).
- **Solution**: In Render Static Site settings, add a **Rewrite** rule:
  - Source: `/*`
  - Destination: `/index.html`

### 4. MongoDB Connection Timeout or `MongooseServerSelectionError`
- **Cause**: MongoDB Atlas Network Access has not whitelisted all IP addresses.
- **Solution**: In MongoDB Atlas, go to **Network Access** > **IP Access List** > add `0.0.0.0/0` (Allow access from anywhere). Render instances use dynamic IP addresses.

### 5. Render Free Tier Spin-Down (Cold Starts)
- Free Render Web Services spin down after 15 minutes of inactivity. The first request after sleep may take ~50 seconds to wake up.
- You can ping the health check endpoint (`https://<backend-name>.onrender.com/api/health`) using a free cron monitoring service (such as UptimeRobot or Cron-Job.org) every 10 minutes to keep the instance warm.

---

🎉 **Congratulations! Your Collaborative Session Engine is now deployed and ready for live proctoring and collaborative coding on Render!**
