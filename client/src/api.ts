import type { FileVisibility, PublicSession, Role } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function fetchSession(sessionId: string, role: Role): Promise<PublicSession> {
  const response = await fetch(`${API_URL}/api/sessions/${sessionId}?role=${role}`);

  if (!response.ok) {
    throw new Error("Failed to load session");
  }

  return response.json();
}

export async function updateAccess(
  sessionId: string,
  fileId: string,
  role: Role,
  access: Partial<{ visibility: FileVisibility; locked: boolean }>
) {
  const response = await fetch(`${API_URL}/api/sessions/${sessionId}/files/${fileId}/access`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": role
    },
    body: JSON.stringify(access)
  });

  if (!response.ok) {
    throw new Error("Failed to update file access");
  }

  return response.json();
}

export { API_URL };
