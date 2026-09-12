// src/lib/api.js
// Thin fetch wrapper around the SchemeSaathi API. All calls are same-origin
// (the Vite dev server proxies /api to the Express server; in production the
// server serves the built client), so the httpOnly auth cookie rides along
// automatically with `credentials: "include"` — no token juggling in JS.

const BASE = "/api";

/** Error thrown for any non-2xx response, carrying the server's error envelope. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || code || `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function toQuery(params) {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // Skip empty/undefined so blank filters don't hit the server as "".
    if (value === undefined || value === null || value === "") continue;
    usp.append(key, value);
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function request(path, { method = "GET", body, params, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}${toQuery(params)}`, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    // Network failure, server down, DNS, etc. — give the UI something typed.
    throw new ApiError(0, "network_error", "Could not reach the server. Check your connection.");
  }

  // 204 and empty bodies are valid successes.
  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const envelope = data?.error ?? {};
    throw new ApiError(res.status, envelope.code, envelope.message, envelope.details);
  }
  return data;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};

// --- Endpoint helpers ------------------------------------------------------
// Grouped by domain so pages import intent, not URL strings.

export const authApi = {
  register: (payload) => api.post("/auth/register", payload),
  login: (payload) => api.post("/auth/login", payload),
  logout: () => api.post("/auth/logout"),
  me: (opts) => api.get("/auth/me", opts),
  updateMe: (payload) => api.patch("/auth/me", payload),
  changePassword: (payload) => api.post("/auth/change-password", payload),
};

export const schemesApi = {
  list: (params, opts) => api.get("/schemes", { ...opts, params }),
  eligibleTypes: (opts) => api.get("/schemes/eligible-types", opts),
  get: (id, opts) => api.get(`/schemes/${encodeURIComponent(id)}`, opts),
};

export const recommendationsApi = {
  create: (input) => api.post("/recommendations", input),
  list: (opts) => api.get("/recommendations", opts),
  latest: (opts) => api.get("/recommendations/latest", opts),
};

export const emiApi = {
  calculate: (input, opts) => api.post("/emi/calculate", input, opts),
  listScenarios: (opts) => api.get("/emi/scenarios", opts),
  saveScenario: (payload) => api.post("/emi/scenarios", payload),
  deleteScenario: (id) => api.delete(`/emi/scenarios/${encodeURIComponent(id)}`),
};

export const partnersApi = {
  list: (params, opts) => api.get("/partners", { ...opts, params }),
  summary: (opts) => api.get("/partners/summary", opts),
  get: (id, opts) => api.get(`/partners/${encodeURIComponent(id)}`, opts),
};

export const geoApi = {
  lookup: (q, opts) => api.get("/geo/lookup", { ...opts, params: { q } }),
  suggest: (q, opts) => api.get("/geo/suggest", { ...opts, params: { q } }),
};

export const contentApi = {
  glossary: (lang, opts) => api.get("/glossary", { ...opts, params: { lang } }),
  personas: (lang, opts) => api.get("/personas", { ...opts, params: { lang } }),
};

export const profileApi = {
  get: (opts) => api.get("/profile", opts),
  save: (payload) => api.patch("/profile", payload),
  reset: () => api.delete("/profile"),
  markStep: (step) => api.post(`/profile/steps/${encodeURIComponent(step)}`),
  saveScheme: (schemeId) => api.post("/profile/saved-schemes", { schemeId }),
  unsaveScheme: (schemeId) => api.delete(`/profile/saved-schemes/${encodeURIComponent(schemeId)}`),
};

export const applicationsApi = {
  list: (params, opts) => api.get("/applications", { ...opts, params }),
  stats: (opts) => api.get("/applications/stats", opts),
  get: (id, opts) => api.get(`/applications/${encodeURIComponent(id)}`, opts),
  create: (payload) => api.post("/applications", payload),
  update: (id, payload) => api.patch(`/applications/${encodeURIComponent(id)}`, payload),
  transition: (id, payload) => api.post(`/applications/${encodeURIComponent(id)}/transitions`, payload),
  updateDocument: (id, documentId, payload) =>
    api.patch(
      `/applications/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`,
      payload
    ),
};

export const chatApi = {
  send: (messages, lang, opts) => api.post("/chat", { messages, lang }, opts),
};

export const dashboardApi = {
  get: (opts) => api.get("/dashboard", opts),
};

export const adminApi = {
  overview: (opts) => api.get("/admin/overview", opts),
  queue: (params, opts) => api.get("/admin/queue", { ...opts, params }),
  users: (params, opts) => api.get("/admin/users", { ...opts, params }),
};
