// src/components/ChatWidget.jsx
// Two ways to render the same assistant:
//  - variant="floating" (default): the original bottom-right bubble that
//    opens into a small panel. Used on narrow screens (see Layout.jsx),
//    since a permanent sidebar can't coexist with real content there.
//  - variant="sidebar": always-open, fills its parent container. Used in
//    the permanent right-hand column on larger screens.
// Both share the same state/logic (messages, voice input/output) — only the
// outer chrome differs.
//
// Voice is handled entirely by the browser's built-in Web Speech API — no
// extra backend or API key needed. Support varies: Chrome/Edge support both
// recognition and synthesis well, Firefox/Safari are patchier. The mic
// button and speaker toggle just hide themselves when unsupported.

import { useEffect, useRef, useState, useCallback } from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { chatApi, ApiError } from "../lib/api.js";

// Web Speech API recognition dialects per app language.
const RECOGNITION_LANG = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };
// speechSynthesis voice lookup is looser — these are common matches.
const SYNTHESIS_LANG = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

const SpeechRecognitionApi =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const speechSynthesisApi = typeof window !== "undefined" ? window.speechSynthesis : null;

export default function ChatWidget({ variant = "floating" }) {
  const { t, lang } = useLanguage();
  const isSidebar = variant === "sidebar";
  const [open, setOpen] = useState(isSidebar); // sidebar is always "open"
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true); // whether replies are read aloud
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, loading]);

  // Stop any in-progress mic/speech when a floating panel closes or unmounts.
  useEffect(() => {
    if (!isSidebar && !open) {
      recognitionRef.current?.stop();
      speechSynthesisApi?.cancel();
      setListening(false);
    }
    return () => {
      recognitionRef.current?.stop();
      speechSynthesisApi?.cancel();
    };
  }, [open, isSidebar]);

  const speak = useCallback(
    (text) => {
      if (!voiceOn || !speechSynthesisApi || !text) return;
      speechSynthesisApi.cancel(); // don't overlap with a previous reply
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = SYNTHESIS_LANG[lang] ?? "en-IN";
      speechSynthesisApi.speak(utterance);
    },
    [voiceOn, lang]
  );

  const sendText = useCallback(
    async (text) => {
      const clean = text.trim();
      if (!clean || loading) return;

      const next = [...messages, { role: "user", content: clean }];
      setMessages(next);
      setInput("");
      setError(null);
      setLoading(true);

      try {
        const { reply } = await chatApi.send(next, lang);
        setMessages([...next, { role: "assistant", content: reply }]);
        speak(reply);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t("chat.error"));
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, lang, speak, t]
  );

  function handleSubmit(e) {
    e.preventDefault();
    sendText(input);
  }

  function toggleListening() {
    if (!SpeechRecognitionApi) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    speechSynthesisApi?.cancel(); // don't listen while the bot is still talking

    const recognition = new SpeechRecognitionApi();
    recognition.lang = RECOGNITION_LANG[lang] ?? "en-IN";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setInput(transcript);
      if (event.results[event.results.length - 1].isFinal) {
        sendText(transcript);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  const panel = (
    <div
      className={
        isSidebar
          ? "h-full flex flex-col bg-white"
          : "mb-3 w-[calc(100vw-32px)] max-w-sm h-[60vh] max-h-[480px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      }
    >
      <div className={`bg-navy-700 text-white px-4 py-3 flex items-center justify-between flex-shrink-0 ${isSidebar ? "" : ""}`}>
        <div className="font-bold text-sm">{t("chat.title")}</div>
        <div className="flex items-center gap-1">
          {speechSynthesisApi && (
            <button
              onClick={() => {
                setVoiceOn((v) => !v);
                speechSynthesisApi.cancel();
              }}
              className="text-white/80 hover:text-white text-base leading-none px-1.5 py-1 rounded hover:bg-white/10"
              aria-label={voiceOn ? t("chat.voice.mute") : t("chat.voice.unmute")}
              title={voiceOn ? t("chat.voice.mute") : t("chat.voice.unmute")}
            >
              {voiceOn ? "🔊" : "🔇"}
            </button>
          )}
          {!isSidebar && (
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white text-lg leading-none px-1"
              aria-label={t("chat.close")}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-slate-600 bg-navy-50/60 border border-navy-500/20 rounded-lg p-3">
            {t("chat.greeting")}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-navy-700 text-white ml-auto"
                : "bg-slate-100 text-slate-800"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="bg-slate-100 text-slate-500 text-sm rounded-lg px-3 py-2 w-fit">
            {t("chat.thinking")}
          </div>
        )}
        {listening && (
          <div className="bg-navy-50 text-navy-700 text-sm rounded-lg px-3 py-2 w-fit flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {t("chat.listening")}
          </div>
        )}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2.5 border-t border-slate-200 flex-shrink-0">
        {SpeechRecognitionApi && (
          <button
            type="button"
            onClick={toggleListening}
            disabled={loading}
            className={`w-10 h-10 rounded-full grid place-items-center text-base flex-shrink-0 transition-colors ${
              listening ? "bg-red-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            } disabled:opacity-50`}
            aria-label={listening ? t("chat.mic.stop") : t("chat.mic.start")}
            title={listening ? t("chat.mic.stop") : t("chat.mic.start")}
          >
            🎤
          </button>
        )}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("chat.placeholder")}
          disabled={loading}
          className="flex-1 min-w-0 text-sm border border-slate-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-primary !min-h-[40px] !py-2 !px-4 text-sm flex-shrink-0 disabled:opacity-50"
        >
          {t("chat.send")}
        </button>
      </form>
    </div>
  );

  if (isSidebar) {
    return panel;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end">
      {open && panel}
      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full bg-navy-700 text-white shadow-card grid place-items-center text-2xl hover:scale-105 transition-transform"
        aria-label={open ? t("chat.close") : t("chat.open")}
      >
        {open ? "×" : "💬"}
      </button>
    </div>
  );
}
