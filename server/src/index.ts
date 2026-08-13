import "dotenv/config";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { canEditFile, canManagePermissions, canViewFile } from "./access.js";
import type { FileVisibility, Role } from "./models.js";
import { addAuditEvent, getSession, listSessions, updateFileAccess, updateFileContent } from "./store.js";

const port = Number(process.env.PORT ?? 4000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const currentDir = dirname(fileURLToPath(import.meta.url));
const clientDistPath = join(currentDir, "../../client/dist");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: clientOrigin,
    methods: ["GET", "POST", "PATCH"]
  }
});

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

function parseRole(value: unknown): Role {
  if (value === "interviewer" || value === "proctor" || value === "candidate") {
    return value;
  }

  return "candidate";
}

function publicSession(sessionId: string, role: Role) {
  const session = getSession(sessionId);

  if (!session) {
    return undefined;
  }

  return {
    id: session.id,
    title: session.title,
    role,
    files: session.files.filter((file) => canViewFile(role, file)),
    events: role === "candidate" ? [] : session.events
  };
}

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "cse-server" });
});

app.get("/api/sessions", (_request, response) => {
  response.json(listSessions().map(({ id, title, createdAt }) => ({ id, title, createdAt })));
});

app.get("/api/sessions/:sessionId", (request, response) => {
  const role = parseRole(request.query.role);
  const session = publicSession(request.params.sessionId, role);

  if (!session) {
    response.status(404).json({ message: "Session not found" });
    return;
  }

  response.json(session);
});

app.get("/api/sessions/:sessionId/replay", (request, response) => {
  const role = parseRole(request.query.role);
  const session = getSession(request.params.sessionId);

  if (!session) {
    response.status(404).json({ message: "Session not found" });
    return;
  }

  if (role === "candidate") {
    response.status(403).json({ message: "Only interviewer or proctor can view replay events" });
    return;
  }

  response.json({ events: session.events });
});

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api")) {
      next();
      return;
    }

    response.sendFile(join(clientDistPath, "index.html"));
  });
}

app.patch("/api/sessions/:sessionId/files/:fileId/access", (request, response) => {
  const role = parseRole(request.header("x-user-role"));

  if (!canManagePermissions(role)) {
    response.status(403).json({ message: "Only interviewer or proctor can manage file access" });
    return;
  }

  const visibility = request.body.visibility as FileVisibility | undefined;
  const locked = request.body.locked as boolean | undefined;
  const file = updateFileAccess(request.params.sessionId, request.params.fileId, { visibility, locked });

  if (!file) {
    response.status(404).json({ message: "File not found" });
    return;
  }

  const events = [];
  if (visibility === "visible") {
    events.push(addAuditEvent(request.params.sessionId, "file_revealed", role, `${file.name} revealed`, file.id, file));
  }

  if (visibility === "hidden") {
    events.push(addAuditEvent(request.params.sessionId, "file_hidden", role, `${file.name} hidden`, file.id, file));
  }

  if (locked === true) {
    events.push(addAuditEvent(request.params.sessionId, "file_locked", role, `${file.name} locked`, file.id, file));
  }

  if (locked === false) {
    events.push(addAuditEvent(request.params.sessionId, "file_unlocked", role, `${file.name} unlocked`, file.id, file));
  }

  io.to(request.params.sessionId).emit("access-updated", { file, events });
  response.json({ file, events });
});

io.on("connection", (socket) => {
  socket.on("join-session", ({ sessionId, role }: { sessionId: string; role: Role }) => {
    socket.join(sessionId);
    socket.data.sessionId = sessionId;
    socket.data.role = parseRole(role);
    socket.emit("session-state", publicSession(sessionId, socket.data.role));
  });

  socket.on("file-change", ({ sessionId, fileId, content }: { sessionId: string; fileId: string; content: string }) => {
    const role = parseRole(socket.data.role);
    const session = getSession(sessionId);
    const file = session?.files.find((item) => item.id === fileId);

    if (!session || !file) {
      socket.emit("edit-rejected", { message: "File not found" });
      return;
    }

    if (!canEditFile(role, file)) {
      const event = addAuditEvent(sessionId, "edit_rejected", role, `Edit rejected for ${file.name}`, file.id, {
        locked: file.locked,
        visibility: file.visibility
      });
      socket.emit("edit-rejected", { message: `${file.name} is locked or hidden`, event });
      return;
    }

    const updatedFile = updateFileContent(sessionId, fileId, content);
    const event = addAuditEvent(sessionId, "file_changed", role, `${file.name} changed`, file.id, {
      length: content.length
    });

    socket.to(sessionId).emit("file-updated", { file: updatedFile, event });
    io.to(sessionId).emit("audit-event", event);
  });
});

httpServer.listen(port, () => {
  console.log(`CSE server running on http://localhost:${port}`);
});
