import type { Role, SessionFile } from "./models.js";

export function canViewFile(role: Role, file: SessionFile): boolean {
  if (role === "interviewer" || role === "proctor") {
    return true;
  }

  return file.visibility === "visible";
}

export function canEditFile(role: Role, file: SessionFile): boolean {
  if (role !== "candidate") {
    return role === "interviewer" && !file.locked;
  }

  return file.visibility === "visible" && !file.locked;
}

export function canManagePermissions(role: Role): boolean {
  return role === "interviewer" || role === "proctor";
}
