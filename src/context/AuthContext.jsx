// src/context/AuthContext.jsx
// Holds the signed-in user and exposes login/register/logout. On mount it asks
// the server who we are (the httpOnly cookie is the source of truth); until that
// resolves, `loading` is true so guards don't bounce a real session to /login.

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, ApiError } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    authApi
      .me({ signal: controller.signal })
      .then((data) => setUser(data.user))
      .catch((err) => {
        // 401 just means "not signed in" — anything else is worth surfacing later.
        if (err?.name !== "AbortError" && !(err instanceof ApiError && err.status === 401)) {
          console.warn("[auth] session check failed:", err);
        }
        setUser(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  // Let pages that patch the profile/account refresh the cached user.
  const refresh = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const isOfficer = user?.role === "officer" || user?.role === "admin";
  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refresh, setUser, isOfficer, isAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}
