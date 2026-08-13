import { randomUUID } from "node:crypto";
import type { AuditEvent, AuditEventType, CseSession, FileVisibility, Role } from "./models.js";

const now = () => new Date().toISOString();

function createInitialSession(): CseSession {
  const sessionId = "demo-session";

  return {
    id: sessionId,
    title: "CSE Demo Interview Session",
    createdAt: now(),
    files: [
      {
        id: "problem",
        name: "problem.md",
        language: "markdown",
        visibility: "visible",
        locked: true,
        content: "# Round 1: Array Check\n\nWrite a function that returns true when an array contains duplicate values."
      },
      {
        id: "starter",
        name: "starter.c",
        language: "c",
        visibility: "visible",
        locked: true,
        content: "#include <stdio.h>\n#include <stdbool.h>\n\nbool containsDuplicate(int arr[], int n);\n"
      },
      {
        id: "solution",
        name: "solution.c",
        language: "c",
        visibility: "visible",
        locked: false,
        content: "#include \"starter.c\"\n\nbool containsDuplicate(int arr[], int n) {\n    // Write your solution here\n    return false;\n}\n"
      },
      {
        id: "hint",
        name: "hint.md",
        language: "markdown",
        visibility: "hidden",
        locked: true,
        content: "Hint: Sorting or hashing can reduce repeated comparison work."
      }
    ],
    events: []
  };
}

const sessions = new Map<string, CseSession>();
const initialSession = createInitialSession();
sessions.set(initialSession.id, initialSession);

export function getSession(sessionId: string): CseSession | undefined {
  return sessions.get(sessionId);
}

export function listSessions(): CseSession[] {
  return [...sessions.values()];
}

export function addAuditEvent(
  sessionId: string,
  type: AuditEventType,
  actorRole: Role,
  message: string,
  fileId?: string,
  snapshot?: unknown
): AuditEvent {
  const session = getSession(sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const event: AuditEvent = {
    id: randomUUID(),
    sessionId,
    type,
    actorRole,
    fileId,
    message,
    createdAt: now(),
    snapshot
  };

  session.events.unshift(event);
  return event;
}

export function updateFileContent(sessionId: string, fileId: string, content: string) {
  const session = getSession(sessionId);
  const file = session?.files.find((item) => item.id === fileId);

  if (!session || !file) {
    return undefined;
  }

  file.content = content;
  return file;
}

export function updateFileAccess(
  sessionId: string,
  fileId: string,
  access: Partial<{ visibility: FileVisibility; locked: boolean }>
) {
  const session = getSession(sessionId);
  const file = session?.files.find((item) => item.id === fileId);

  if (!session || !file) {
    return undefined;
  }

  if (access.visibility) {
    file.visibility = access.visibility;
  }

  if (typeof access.locked === "boolean") {
    file.locked = access.locked;
  }

  return file;
}
