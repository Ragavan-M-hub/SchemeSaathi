import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import ChatWidget from "./ChatWidget.jsx";

const baseLinks = [
  { to: "/", labelKey: "nav.home" },
  { to: "/schemes", labelKey: "nav.schemes" },
  { to: "/emi", labelKey: "nav.emi" },
  { to: "/partners", labelKey: "nav.partners" },
];

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const { lang, setLang, t, supported } = useLanguage();
  const { user, isOfficer, logout } = useAuth();

  const links = [
    ...baseLinks,
    ...(user ? [{ to: "/dashboard", labelKey: "nav.dashboard" }] : []),
    ...(user ? [{ to: "/applications", labelKey: "nav.applications" }] : []),
    ...(isOfficer ? [{ to: "/admin", labelKey: "nav.admin" }] : []),
  ];

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/");
  };

  return (
    <div className="app-shell min-h-screen flex flex-col">

      {/* Announcement */}
      <div className="announcement">
        <span className="announcement-dot" />
        Discover benefits matched to your profile
      </div>

      {/* ================= HEADER ================= */}
      <header
        className="relative z-50 bg-white"
        style={{ height: "73px" }}
      >
        <div className="modern-header">

          {/* Logo */}
          <Link to="/" className="modern-brand">
            <span className="modern-brand-mark">S</span>

            <span>
              Scheme<span>Saathi</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="modern-nav">
            {links.slice(0, 4).map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  isActive ? "active" : ""
                }
              >
                {t(l.labelKey)}
              </NavLink>
            ))}
          </nav>

          {/* Header Actions */}
          <div className="modern-actions">

            {/* Language Selector */}
            <div className="relative">

              <button
                className="modern-action"
                onClick={() => setLangOpen(!langOpen)}
                aria-label={t("lang.switch")}
              >
                🌐
              </button>

              {langOpen && (
                <>
                  {/* Click outside */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setLangOpen(false)}
                  />

                  {/* Language menu */}
                  <div
                    className="
                      absolute
                      right-0
                      mt-2
                      bg-white
                      border
                      border-slate-200
                      rounded-lg
                      shadow-lg
                      z-50
                      min-w-[130px]
                      overflow-hidden
                    "
                  >
                    {supported.map((code) => (
                      <button
                        key={code}
                        onClick={() => {
                          setLang(code);
                          setLangOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm ${
                          lang === code
                            ? "bg-emerald-50 text-emerald-700 font-semibold"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        {t(`lang.${code}`)}
                      </button>
                    ))}
                  </div>
                </>
              )}

            </div>

            {/* Authentication */}
            {user ? (
              <>
                <Link
                  className="modern-profile"
                  to="/dashboard"
                >
                  <span className="modern-avatar">
                    {(user.name || "U")
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>

                  <span className="hidden sm:inline">
                    {user.name}
                  </span>
                </Link>

                <button
                  className="modern-profile"
                  onClick={handleLogout}
                >
                  {t("nav.logout")}
                </button>
              </>
            ) : (
              <Link
                className="modern-login"
                to="/login"
              >
                {t("nav.login")}
              </Link>
            )}

            {/* Mobile Menu */}
            <button
              className="modern-menu"
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
            >
              ☰
            </button>

          </div>
        </div>

        {/* Mobile Navigation */}
        <nav
          className={`modern-mobile ${
            open ? "open" : ""
          }`}
        >
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              {t(l.labelKey)}
            </NavLink>
          ))}

          {user ? (
            <button onClick={handleLogout}>
              {t("nav.logout")} · {user.name}
            </button>
          ) : (
            <NavLink
              to="/login"
              onClick={() => setOpen(false)}
            >
              {t("nav.login")}
            </NavLink>
          )}
        </nav>
      </header>

      {/* ================= MAIN AREA ================= */}
      <div className="flex-1 min-w-0">

        {/* Main Content */}
        <main
          key={location.pathname}
          className="
            modern-main
            min-w-0
            lg:pr-[360px]
            xl:pr-[380px]
          "
        >
          <div className="w-full px-4 py-6 md:px-6 md:py-10">
            {children}
          </div>
        </main>

        {/* ================= FIXED CHATBOT ================= */}
        <aside
          className="
            hidden
            lg:flex
            lg:flex-col
            fixed
            right-0
            bottom-0
            w-[360px]
            xl:w-[380px]
            border-l
            border-slate-200
            bg-white
            z-30
            overflow-hidden
          "
          style={{
            top: "73px",
          }}
        >
          <ChatWidget variant="sidebar" />
        </aside>

      </div>

      {/* ================= FOOTER ================= */}
      <footer className="modern-footer">

        <Link
          to="/"
          className="modern-brand"
        >
          <span className="modern-brand-mark">
            S
          </span>

          <span>
            Scheme<span>Saathi</span>
          </span>
        </Link>

        <span>
          {lang === "hi"
            ? "हर लाभ को समझना आसान बनाएं।"
            : lang === "mr"
            ? "प्रत्येक लाभ समजणे सोपे करा."
            : "Making every benefit easier to reach."
          }
        </span>

        <div className="footer-links">
          <Link to="/about">
            About
          </Link>

          <Link to="/schemes">
            How it works
          </Link>

          <Link to="/partners">
            Help centres
          </Link>
        </div>

        <span>
          © 2026 SchemeSaathi
        </span>

      </footer>

      {/* ================= MOBILE CHATBOT ================= */}
      <div className="lg:hidden">
        <ChatWidget variant="floating" />
      </div>

    </div>
  );
}