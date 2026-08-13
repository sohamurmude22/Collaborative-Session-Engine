# Setup Guide

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- Optional: Docker Desktop for PostgreSQL and Redis

## 1. Install Dependencies

From the project root:

```bash
npm install
```

## 2. Configure Environment

Copy the backend environment example:

```bash
copy server\.env.example server\.env
```

The prototype runs with in-memory data by default. PostgreSQL and Redis values are included for future persistence integration.

## 3. Optional Database Services

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

## 4. Run the Project

```bash
npm run build
npm run start
```

Open:

- App: http://localhost:4000
- Backend: http://localhost:4000/health

During development, you can also try `npm run dev`, which starts the backend and Vite frontend separately. If Vite has trouble scanning dependencies on Windows or OneDrive, use the build/start flow above.

## 5. Demo Flow

1. Open the app as `interviewer`.
2. Select `solution.c` and edit the code.
3. Lock `solution.c` from the access-control panel.
4. Switch to `candidate` and try editing the locked file.
5. Reveal `hint.md` as interviewer.
6. Check the replay timeline as interviewer or proctor.

## 6. Build for Production

```bash
npm run build
npm run start
```

## Troubleshooting

If the frontend cannot connect to the backend, confirm that the backend is running on port `4000` and that `CLIENT_ORIGIN` in `server/.env` matches the frontend URL.

If dependencies fail to install, delete `node_modules` and `package-lock.json`, then run `npm install` again.
