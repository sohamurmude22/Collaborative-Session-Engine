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
5. [Deployment Method 2: One-Click Render Blueprint (`render.yaml`)](#deployment-method-2-one-click-render-blueprint-renderyaml)
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

## ⚡ Deployment Method 2: One-Click Render Blueprint (`render.yaml`)

This repository includes a pre-configured `render.yaml` file that sets up both the backend and frontend simultaneously with Infrastructure-as-Code.

1. Ensure `render.yaml` is committed and pushed to your GitHub repository.
2. Go to the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** > select **Blueprint**.
4. Select your repository.
5. Render will detect `render.yaml` and prompt you for the uncommitted environment parameters:
   - `MONGO_URI`: Enter your MongoDB Atlas connection string.
   - `CLIENT_URL`: Enter your anticipated frontend URL or leave blank to set after initial deploy.
6. Click **Apply**. Render will automatically provision:
   - Backend web service (`cse-backend`) with health checks and auto-generated `JWT_SECRET`.
   - Frontend static site (`cse-frontend`) with SPA redirect rules and CDN caching.

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
