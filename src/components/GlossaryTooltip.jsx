import { useState, useRef, useEffect } from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { getGlossaryEntry } from "../data/glossary.js";

export default function GlossaryTooltip({ term, children }) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const entry = getGlossaryEntry(term, lang);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    // Delay so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
      document.addEventListener("touchstart", handler);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // Position popover near trigger, clamped to viewport
  useEffect(() => {
    if (!open || !triggerRef.current || !popoverRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const pop = popoverRef.current;
    const popWidth = 320;
    const viewportW = window.innerWidth;

    // Horizontal: center on trigger, clamp to viewport
    let left = rect.left + rect.width / 2 - popWidth / 2;
    left = Math.max(8, Math.min(left, viewportW - popWidth - 8));

    // Vertical: prefer above; if not enough space, go below
    const spaceAbove = rect.top;
    const top = spaceAbove > 240 ? rect.top - 8 : rect.bottom + 8;
    const transform = spaceAbove > 240 ? "translateY(-100%)" : "translateY(0)";

    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    pop.style.transform = transform;
  }, [open, lang]);

  if (!entry) return children || <span>{term}</span>;

  return (
    <span className="relative inline-block" ref={triggerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-0.5 text-navy-700 font-semibold underline decoration-dotted underline-offset-2 cursor-help"
        aria-label={`What is ${entry.term}?`}
      >
        {children || entry.term}
        <span className="text-xs ml-0.5 opacity-60">ⓘ</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="fixed z-50 w-[calc(100vw-16px)] max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-4 text-left"
          role="dialog"
        >
          <div className="text-xs font-bold text-navy-700 uppercase tracking-wide mb-1">
            📖 {lang === "en" ? "What is" : lang === "hi" ? "क्या है" : "म्हणजे काय"}
          </div>
          <div className="font-bold text-navy-900 text-base mb-2">{entry.term}</div>
          <p className="text-sm text-slate-700 leading-relaxed">{entry.plain}</p>
          {entry.example && (
            <div className="mt-3 bg-navy-50/60 border border-navy-500/20 rounded-lg p-2.5">
              <div className="text-xs font-bold text-navy-700 mb-1">
                💡 {lang === "en" ? "Example" : lang === "hi" ? "उदाहरण" : "उदाहरण"}
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{entry.example}</p>
            </div>
          )}
          <button
            className="mt-3 text-xs text-slate-500 hover:text-navy-700"
            onClick={() => setOpen(false)}
          >
            {lang === "en" ? "Close" : lang === "hi" ? "बंद करें" : "बंद करा"}
          </button>
        </div>
      )}
    </span>
  );
}