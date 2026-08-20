import { getAuthToken } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Filtra undefined, null, "undefined", "null" y strings vacíos
function buildParams(params?: Record<string, any>): string {
  if (!params) return "";
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "undefined" && v !== "null" && v !== "") {
      clean[k] = String(v);
    }
  }
  const qs = new URLSearchParams(clean).toString();
  return qs ? `?${qs}` : "";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    redirect: "follow",
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
    request<any[]>(`/api/notes/${buildParams(params)}`),
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
    request<any[]>(`/api/tasks/${buildParams(params)}`),
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
  upcoming: () => request<any[]>("/api/reminders/upcoming"),
  create: (data: any) => request<any>("/api/reminders/", { method: "POST", body: JSON.stringify(data) }),
  dismiss: (id: string) => request<any>(`/api/reminders/${id}/dismiss`, { method: "PATCH" }),
  delete: (id: string) => request<any>(`/api/reminders/${id}`, { method: "DELETE" }),
  weeklySummary: () => request<any>("/api/reminders/weekly-summary"),
  sendDailyDigest: () => request<any>("/api/reminders/send-daily-digest", { method: "POST" }),
};

// ── Finanzas ───────────────────────────────────────────────
export const finanzasApi = {
  setup: () => request<any>("/api/finanzas/setup", { method: "POST" }),
  joinFamily: (id: string) => request<any>(`/api/finanzas/join-family/${id}`, { method: "POST" }),
  categories: () => request<any[]>("/api/finanzas/categories"),
  dashboard: (month?: number, year?: number) => request<any>(`/api/finanzas/dashboard${buildParams({ month, year })}`),
  advice: (month?: number, year?: number) => request<any>(`/api/finanzas/advice${buildParams({ month, year })}`),
  expenses: {
    list: (p?: { month?: number; year?: number; category_id?: string }) => request<any[]>(`/api/finanzas/expenses${buildParams(p)}`),
    create: (d: any) => request<any>("/api/finanzas/expenses", { method: "POST", body: JSON.stringify(d) }),
    fromChat: (message: string) => request<any>("/api/finanzas/expenses/from-chat", { method: "POST", body: JSON.stringify({ message }) }),
    delete: (id: string) => request<any>(`/api/finanzas/expenses/${id}`, { method: "DELETE" }),
  },
  incomes: {
    list: (p?: { month?: number; year?: number }) => request<any[]>(`/api/finanzas/incomes${buildParams(p)}`),
    create: (d: any) => request<any>("/api/finanzas/incomes", { method: "POST", body: JSON.stringify(d) }),
  },
  fixedExpenses: {
    list: () => request<any[]>("/api/finanzas/fixed-expenses"),
    create: (d: any) => request<any>("/api/finanzas/fixed-expenses", { method: "POST", body: JSON.stringify(d) }),
    delete: (id: string) => request<any>(`/api/finanzas/fixed-expenses/${id}`, { method: "DELETE" }),
  },
  budgets: {
    list: (p?: { month?: number; year?: number }) => request<any[]>(`/api/finanzas/budgets${buildParams(p)}`),
    upsert: (d: any) => request<any>("/api/finanzas/budgets", { method: "POST", body: JSON.stringify(d) }),
  },
  savings: {
    list: () => request<any[]>("/api/finanzas/savings"),
    create: (d: any) => request<any>("/api/finanzas/savings", { method: "POST", body: JSON.stringify(d) }),
    addMovement: (id: string, d: any) => request<any>(`/api/finanzas/savings/${id}/movements`, { method: "POST", body: JSON.stringify(d) }),
    movements: (id: string) => request<any[]>(`/api/finanzas/savings/${id}/movements`),
  },
};
