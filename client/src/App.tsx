import Editor from "@monaco-editor/react";
import { Eye, EyeOff, Lock, Unlock, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL, fetchSession, updateAccess } from "./api";
import type { AuditEvent, PublicSession, Role, SessionFile } from "./types";

const SESSION_ID = "demo-session";
const roles: Role[] = ["candidate", "interviewer", "proctor"];

export function App() {
  const [role, setRole] = useState<Role>("interviewer");
  const [session, setSession] = useState<PublicSession | null>(null);
  const [activeFileId, setActiveFileId] = useState("solution");
  const [status, setStatus] = useState("Connecting...");
  const [warning, setWarning] = useState("");
  const socketRef = useRef<Socket | null>(null);

  const activeFile = useMemo(
    () => session?.files.find((file) => file.id === activeFileId) ?? session?.files[0],
    [activeFileId, session]
  );

  const loadSession = async (nextRole = role) => {
    const data = await fetchSession(SESSION_ID, nextRole);
    setSession(data);

    if (!data.files.some((file) => file.id === activeFileId)) {
      setActiveFileId(data.files[0]?.id ?? "");
    }
  };

  useEffect(() => {
    loadSession(role).catch((error) => setStatus(error.message));
  }, [role]);

  useEffect(() => {
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("Live session connected");
      socket.emit("join-session", { sessionId: SESSION_ID, role });
    });

    socket.on("session-state", (state: PublicSession) => {
      if (state) {
        setSession(state);
      }
    });

    socket.on("file-updated", ({ file }: { file: SessionFile }) => {
      setSession((current) => replaceFile(current, file));
    });

    socket.on("access-updated", ({ file, events }: { file: SessionFile; events: AuditEvent[] }) => {
      setSession((current) => {
        const next = replaceFile(current, file);
        if (!next) {
          return next;
        }

        if (role === "candidate" && file.visibility === "hidden") {
          return {
            ...next,
            files: next.files.filter((item) => item.id !== file.id)
          };
        }

        return {
          ...next,
          events: [...events, ...next.events]
        };
      });
      setWarning(`${file.name} permissions changed`);
    });

    socket.on("audit-event", (event: AuditEvent) => {
      setSession((current) => (current && role !== "candidate" ? { ...current, events: [event, ...current.events] } : current));
    });

    socket.on("edit-rejected", ({ message }: { message: string }) => {
      setWarning(message);
    });

    return () => {
      socket.disconnect();
    };
  }, [role]);

  const canManage = role === "interviewer" || role === "proctor";
  const readOnly = !activeFile || activeFile.locked || activeFile.visibility === "hidden" || role === "proctor";

  const changeFileContent = (value = "") => {
    if (!activeFile || readOnly) {
      setWarning(activeFile ? `${activeFile.name} is locked` : "No editable file selected");
      return;
    }

    setSession((current) => replaceFile(current, { ...activeFile, content: value }));
    socketRef.current?.emit("file-change", {
      sessionId: SESSION_ID,
      fileId: activeFile.id,
      content: value
    });
  };

  const toggleLock = async (file: SessionFile) => {
    const result = await updateAccess(SESSION_ID, file.id, role, { locked: !file.locked });
    setSession((current) => replaceFile(current, result.file));
  };

  const toggleVisibility = async (file: SessionFile) => {
    const nextVisibility = file.visibility === "visible" ? "hidden" : "visible";
    const result = await updateAccess(SESSION_ID, file.id, role, { visibility: nextVisibility });
    setSession((current) => replaceFile(current, result.file));
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Collaborative Session Engine</p>
          <h1>CSE Interview Room</h1>
        </div>

        <label className="field-label" htmlFor="role">
          Role
        </label>
        <select id="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
          {roles.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <section className="file-list" aria-label="Session files">
          {session?.files.map((file) => (
            <button
              className={`file-row ${activeFile?.id === file.id ? "active" : ""}`}
              key={file.id}
              onClick={() => setActiveFileId(file.id)}
            >
              <span>{file.name}</span>
              <small>{file.locked ? "Locked" : "Editable"}</small>
            </button>
          ))}
        </section>

        <button className="secondary-action" onClick={() => loadSession()}>
          <RefreshCcw size={16} />
          Refresh
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <strong>{activeFile?.name ?? "No file selected"}</strong>
            <span>{status}</span>
          </div>
          {warning && <button onClick={() => setWarning("")}>{warning}</button>}
        </header>

        <div className="editor-area">
          <Editor
            height="100%"
            theme="vs-dark"
            language={activeFile?.language ?? "plaintext"}
            value={activeFile?.content ?? ""}
            options={{ readOnly, minimap: { enabled: false }, fontSize: 14, wordWrap: "on" }}
            onChange={changeFileContent}
          />
        </div>
      </section>

      <aside className="inspector">
        <section>
          <h2>Access Control</h2>
          {canManage ? (
            session?.files.map((file) => (
              <div className="access-row" key={file.id}>
                <span>{file.name}</span>
                <button title={file.locked ? "Unlock file" : "Lock file"} onClick={() => toggleLock(file)}>
                  {file.locked ? <Lock size={16} /> : <Unlock size={16} />}
                </button>
                <button title={file.visibility === "visible" ? "Hide file" : "Reveal file"} onClick={() => toggleVisibility(file)}>
                  {file.visibility === "visible" ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            ))
          ) : (
            <p className="muted">Candidate view only shows files revealed by the interviewer.</p>
          )}
        </section>

        <section>
          <h2>Replay Timeline</h2>
          <div className="timeline">
            {session?.events.length ? (
              session.events.map((event) => (
                <article key={event.id}>
                  <strong>{event.message}</strong>
                  <span>
                    {event.actorRole} · {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                </article>
              ))
            ) : (
              <p className="muted">No replay events visible for this role.</p>
            )}
          </div>
        </section>
      </aside>
    </main>
  );
}

function replaceFile(session: PublicSession | null, file: SessionFile): PublicSession | null {
  if (!session) {
    return session;
  }

  const exists = session.files.some((item) => item.id === file.id);

  return {
    ...session,
    files: exists ? session.files.map((item) => (item.id === file.id ? file : item)) : [...session.files, file]
  };
}
