// src/i18n/LanguageContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import { translations } from "./translations.js";

const SUPPORTED = ["en", "hi", "mr"];
const STORAGE_KEY = "schemesaathi.lang";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && SUPPORTED.includes(saved) ? saved : "en";
  });

  const setLang = (l) => {
    if (!SUPPORTED.includes(l)) return;
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l; // helps screen readers
  };

  // t("key.path") → falls back to English if missing
  const t = (key, fallback) => {
    const value = translations[lang]?.[key] ?? translations.en?.[key];
    if (value !== undefined) return value;
    if (fallback !== undefined) return fallback;
    return key; // show key itself as last resort (helps spot missing translations)
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, supported: SUPPORTED }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

// Convenience: just the translator
export function useT() {
  return useLanguage().t;
}