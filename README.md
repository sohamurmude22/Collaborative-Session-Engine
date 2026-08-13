<<<<<<< HEAD
# CSE - Collaborative Session Engine

CSE is a mini project prototype for a real-time collaborative code editor with live, file-level access control for technical interviews and coding exams.

The system lets an interviewer or proctor reveal, hide, lock, and unlock files during an active session. It also records a replayable audit timeline showing code changes and permission changes together.

## Key Features

- Real-time collaborative code editing
- Role-based access control for interviewer, proctor, and candidate
- File-level visibility controls
- File locking and unlocking during a live session
- Soft-lock warning flow for candidate edits
- Audit timeline for replay and review
- React + TypeScript frontend with Monaco Editor
- Node.js + Express + TypeScript backend

## Project Structure

```text
.
├── client/              # React + TypeScript frontend
├── server/              # Express + TypeScript API and Socket.IO service
├── docs/                # Setup guide, report, architecture notes
├── docker-compose.yml   # Optional PostgreSQL and Redis services
└── README.md
```

## Quick Start

```bash
npm install
npm run build
npm run start
```

Then open:

- App: http://localhost:4000
- Backend health check: http://localhost:4000/health

For detailed setup, see [docs/SETUP.md](docs/SETUP.md).

## Demo Roles

Use the role selector in the frontend:

- `Candidate`: can only see revealed files and edit unlocked files
- `Interviewer`: can reveal, hide, lock, and unlock files
- `Proctor`: can inspect files and the audit timeline

## Academic Deliverables

The project includes:

- [Setup Guide](docs/SETUP.md)
- [Project Report](docs/PROJECT_REPORT.md)
- [Architecture Notes](docs/ARCHITECTURE.md)
- [API Reference](docs/API_REFERENCE.md)
=======
# Collaborative-Session-Engine
>>>>>>> fde88f79829160b5c3ac463c4167369cca4d204a
