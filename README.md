# Real-Time Collaborative Code Editor with Granular, Replayable Access Control for Interview and Exam Proctoring

A modern collaborative code editor and interview/exam proctoring platform engineered for granular file access control, live session synchronization, and full timeline playback.

---

## Current Development Status

> **Week 1 completed:**  
> Project foundation and frontend-backend-database connectivity.

### Development Roadmap Overview
- [x] **Week 1: Project Setup & Architecture** (Foundational Express/Mongoose backend, React/Vite frontend, live health check, and environment setup)
- [ ] **Week 2: Authentication & User Session Management**
- [ ] **Week 3: Database Schemas & Session State Engine**
- [ ] **Week 4: Monaco Code Editor Integration**
- [ ] **Week 5: Real-Time Synchronization with Yjs & WebSockets**
- [ ] **Week 6: Granular Access Control & Permissions Engine**
- [ ] **Week 7: Code History, Keyframes & Replay Engine**
- [ ] **Week 8: Exam & Interview Proctoring Mode (Anti-Cheating & Telemetry)**
- [ ] **Week 9: Comprehensive Testing & Security Audits**
- [ ] **Week 10: Final Deployment & Optimization**

---

## Tech Stack

### Frontend
- **Framework:** React 18
- **Language:** TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios
- **Routing:** React Router v6
- **Icons:** Lucide React

### Backend
- **Runtime:** Node.js (v20+)
- **Framework:** Express.js
- **Language:** TypeScript
- **Database ODM:** Mongoose
- **Security:** Helmet, CORS
- **Configuration:** dotenv

### Database
- **Database:** MongoDB (Running locally or on MongoDB Atlas)

### Tooling & Development
- **Git & GitHub**
- **Concurrently** (for multi-process dev orchestration)

---

## Project Structure

```text
collaborative-session-engine/
│
├── frontend/                     # React + TypeScript + Vite + Tailwind CSS + Axios
│   ├── public/                   # Static assets
│   ├── src/
│   │   ├── components/           # Reusable UI components (Navbar, Layout, etc.)
│   │   ├── context/              # Global React context providers
│   │   ├── hooks/                # Custom React hooks
│   │   ├── pages/                # Page components (Home, Login, Register, Dashboard)
│   │   ├── services/             # Axios API client & endpoints (api.ts)
│   │   ├── types/                # TypeScript type definitions
│   │   ├── utils/                # Helper utilities
│   │   ├── App.tsx               # Main Router setup
│   │   ├── main.tsx              # React DOM entry point
│   │   └── index.css             # Tailwind base styles
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── .env.example
│   └── package.json
│
├── backend/                      # Node.js + Express + TypeScript + Mongoose
│   ├── src/
│   │   ├── config/
│   │   │   └── db.ts             # Mongoose MongoDB connection
│   │   ├── controllers/
│   │   │   └── health.controller.ts # Health check controller
│   │   ├── middleware/
│   │   │   └── errorHandler.ts   # Centralized error handling
│   │   ├── models/               # Mongoose schema models (Week 2+)
│   │   ├── routes/
│   │   │   ├── index.ts          # Root API router aggregator
│   │   │   └── health.routes.ts  # Health check routes (/api/health)
│   │   ├── services/             # Business logic layer (Week 2+)
│   │   ├── utils/                # Backend utilities and helpers
│   │   ├── app.ts                # Express application configuration & middlewares
│   │   └── server.ts             # Server entry point & DB connector
│   ├── tsconfig.json
│   ├── .env.example
│   └── package.json
│
├── .gitignore
├── README.md
└── package.json                  # Root orchestration package
```

---

## Prerequisites

Before running the project, ensure you have the following installed on your machine:
- **Node.js** (v20.x or higher)
- **npm** (v10.x or higher)
- **MongoDB** running locally on port `27017` or a MongoDB Atlas URI

---

## Environment Variables

### Backend Configuration (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

```bash
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/collaborative-code-editor
CLIENT_URL=http://localhost:5173
```

### Frontend Configuration (`frontend/.env`)

Copy `frontend/.env.example` to `frontend/.env`:

```bash
VITE_API_URL=http://localhost:5000/api
```

---

## How to Install

Install all dependencies across root, backend, and frontend with a single command:

```bash
npm run install:all
```

Or install individually:

```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

---

## How to Run

### Option 1: Run Both Concurrently (Recommended)

From the project root:

```bash
npm run dev
```

This will concurrently launch:
- **Backend API:** `http://localhost:5000`
- **Frontend App:** `http://localhost:5173`

### Option 2: Run Separately

#### Run Backend:
```bash
cd backend
npm run dev
```

#### Run Frontend:
```bash
cd frontend
npm run dev
```

---

## Verification & Health Check

1. Open `http://localhost:5000/api/health` in your browser or terminal:
   ```json
   {
     "success": true,
     "message": "Server is running",
     "timestamp": "2026-08-17T17:15:00.000Z",
     "database": "connected"
   }
   ```
2. Open `http://localhost:5173` in your browser:
   - The Home page tests live communication between Frontend &rarr; Express Backend &rarr; MongoDB.
   - Navigate to `/login`, `/register`, and `/dashboard` to inspect the clean placeholder routes prepared for Week 2.
