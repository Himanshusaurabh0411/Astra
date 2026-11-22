export class WorkspaceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function workspaceRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    signal: init.signal ?? AbortSignal.timeout(15000),
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new WorkspaceError(response.status, typeof data?.detail === "string" ? data.detail : "The request could not be completed.");
  }
  return data as T;
}

export function workspaceErrorMessage(error: unknown, fallback: string) {
  return error instanceof WorkspaceError ? error.message : fallback;
}

export function updateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
  }).format(date);
}
