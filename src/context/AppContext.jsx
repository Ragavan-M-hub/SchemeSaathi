// src/context/AppContext.jsx
// Stores user's journey data across pages. Persists to localStorage.

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "schemesaathi.journey";

const defaultState = {
  // Recommender answers
  purpose: "",
  projectType: "",
  cost: "",
  income: "",
  education: "",
  gender: "",
  // Selected scheme (set when user clicks "Check EMI" or "See Partners")
  selectedSchemeId: null,
  // Persona that was launched (optional)
  _personaActive: null,
  // Journey progress
  stepsCompleted: {
    recommender: false,
    emi: false,
    partners: false,
  },
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultState,
          ...parsed,
          stepsCompleted: {
            ...defaultState.stepsCompleted,
            ...(parsed.stepsCompleted || {}),
          },
        };
      }
    } catch {
      // Ignore parse errors — fall back to default
    }
    return defaultState;
  });

  // Persist on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors (e.g. quota exceeded)
    }
  }, [state]);

  // Merge partial updates into state
  const update = useCallback((updates) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Mark a journey step as completed
  const markStep = useCallback((step) => {
    setState((prev) => ({
      ...prev,
      stepsCompleted: { ...prev.stepsCompleted, [step]: true },
    }));
  }, []);

  // Reset entire journey (used by Home page "Reset my journey" button)
  const resetJourney = useCallback(() => {
    setState(defaultState);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return (
    <AppContext.Provider value={{ state, update, markStep, resetJourney }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within an <AppProvider>");
  }
  return ctx;
}