# Project Report

## Title

CSE: Collaborative Session Engine - A Real-Time Collaborative Code Editor with Granular, Replayable Access Control for Interview and Exam Proctoring

## Abstract

Modern collaborative code editors provide live synchronization but generally treat access control as a static session-level setting. CSE addresses this gap by adding dynamic, file-level permissions to a collaborative coding environment. Interviewers and proctors can hide, reveal, lock, and unlock files while a session is active, and the system records these actions in a replayable audit timeline.

## Problem Statement

Technical interviews and coding exams often require staged problem reveal, protected starter files, locked submissions after time limits, and transparent review of what candidates could see or edit at each moment. Existing collaborative editors usually provide all-or-nothing access control, making them insufficient for structured assessments.

## Objectives

- Study limitations in existing collaborative coding platforms.
- Build a web-based collaborative editor using React, TypeScript, and Monaco Editor.
- Implement a backend permission and lock engine.
- Support live file reveal, hide, lock, and unlock operations.
- Record code and permission events in an audit timeline.
- Provide a working prototype suitable for demonstration.

## Technology Stack

| Component | Technology |
| --- | --- |
| Frontend | React + TypeScript |
| Code Editor | Monaco Editor |
| Backend | Node.js + Express + TypeScript |
| Real-Time Communication | Socket.IO |
| CRDT Library Prepared | Yjs |
| Database Prepared | PostgreSQL |
| Cache Prepared | Redis |
| Styling | CSS |

## Modules

### Frontend Workspace

The frontend provides the editor, file list, role selector, access-control panel, and replay timeline.

### Permission and Lock Engine

The backend enforces role-based rules before accepting edits or permission updates.

### Audit Timeline

Every important event is recorded with actor role, file id, message, timestamp, and snapshot metadata.

### Replay Module

The replay panel shows permission and code events together, helping reviewers understand the exact sequence of a session.

## Outcomes

- Working collaborative editor prototype.
- File-level access-control demonstration.
- Candidate, interviewer, and proctor role behavior.
- Replayable event timeline.
- Setup guide and documentation.

## Future Scope

- Persist sessions in PostgreSQL.
- Use Redis Pub/Sub for multi-server scaling.
- Add JWT authentication and user accounts.
- Integrate full Yjs document updates for CRDT conflict resolution.
- Add exportable replay reports and video demo material.
