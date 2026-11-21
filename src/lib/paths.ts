/** Storage path helpers shared by API routes and the worker. */
import path from "node:path";

export function storageProjectPath(projectId: string) {
  return path.posix.join("projects", projectId);
}

export function storageClipPath(projectId: string, clipId: string) {
  return path.posix.join("projects", projectId, "clips", clipId);
}
