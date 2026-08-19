import { getAuthToken } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Error del servidor" }));
    throw new Error(err.detail || "Error desconocido");
  }
  return res.json();
}

// ── Notes ─────────────────────────────────────────────────
export const notesApi = {
  list: (params?: { project_id?: string; search?: string; archived?: boolean }) =>
    request<any[]>(`/api/notes?${new URLSearchParams(params as any)}`),
  get: (id: string) => request<any>(`/api/notes/${id}`),
  create: (data: any) => request<any>("/api/notes/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/api/notes/${id}`, { method: "DELETE" }),
  uploadImage: async (noteId: string, file: File) => {
    const token = await getAuthToken();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/api/notes/${noteId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    return res.json();
  },
  deleteImage: (noteId: string, imageId: string) =>
    request<any>(`/api/notes/${noteId}/images/${imageId}`, { method: "DELETE" }),
};

// ── Projects ───────────────────────────────────────────────
export const projectsApi = {
  list: () => request<any[]>("/api/projects/"),
  create: (data: any) => request<any>("/api/projects/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/api/projects/${id}`, { method: "DELETE" }),
};

// ── Tasks ──────────────────────────────────────────────────
export const tasksApi = {
  list: (params?: { project_id?: string; completed?: boolean; priority?: string }) =>
    request<any[]>(`/api/tasks/?${new URLSearchParams(params as any)}`),
  create: (data: any) => request<any>("/api/tasks/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/api/tasks/${id}`, { method: "DELETE" }),
  pendingToday: () => request<any[]>("/api/tasks/pending-today"),
};

// ── Chat ───────────────────────────────────────────────────
export const chatApi = {
  send: (message: string, project_id?: string) =>
    request<{ reply: string }>("/api/chat/", { method: "POST", body: JSON.stringify({ message, project_id }) }),
  history: (limit = 20) => request<any[]>(`/api/chat/history?limit=${limit}`),
  clearHistory: () => request<any>("/api/chat/history", { method: "DELETE" }),
};

// ── Reminders ──────────────────────────────────────────────
export const remindersApi = {
  pending: () => request<any[]>("/api/reminders/pending"),
  create: (data: any) => request<any>("/api/reminders/", { method: "POST", body: JSON.stringify(data) }),
  dismiss: (id: string) => request<any>(`/api/reminders/${id}/dismiss`, { method: "PATCH" }),
};
