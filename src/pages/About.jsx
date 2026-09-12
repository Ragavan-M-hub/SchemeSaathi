// src/pages/About.jsx
import { useT, useLanguage } from "../i18n/LanguageContext.jsx";
import { Link } from "react-router-dom";

export default function About() {
  const t = useT();
  const { lang } = useLanguage();

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <div className="inline-block px-3 py-1 bg-saffron-500/10 text-saffron-600 text-xs font-bold rounded-full mb-3">
          {t("about.badge")}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-navy-900">
          {t("about.title")}
        </h1>
        <p className="text-slate-600 mt-3 text-lg">{t("about.subtitle")}</p>
      </div>

      {/* The System */}
      <section className="card">
        <h2 className="text-xl font-bold text-navy-900 mb-3">
          {t("about.system.title")}
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          {t("about.system.p1")}
        </p>
        <div className="bg-navy-50/60 border border-navy-500/20 rounded-lg p-4 mb-4">
          <div className="text-xs font-bold text-navy-700 uppercase tracking-wide mb-3">
            {t("about.system.flow")}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-sm">
            <FlowBox label="NSFDC" sub={t("about.flow.nsfdc")} />
            <Arrow />
            <FlowBox label="SCA" sub={t("about.flow.sca")} />
            <Arrow />
            <FlowBox label={t("about.flow.cp.short")} sub={t("about.flow.cp.desc")} />
            <Arrow />
            <FlowBox label={t("about.flow.beneficiary")} sub={t("about.flow.beneficiary.sub")} highlight />
          </div>
        </div>
        <p className="text-slate-700 leading-relaxed">
          {t("about.system.p2")}
        </p>
      </section>

      {/* The Problem */}
      <section className="card border-l-4 border-l-red-500">
        <h2 className="text-xl font-bold text-navy-900 mb-3">
          🚨 {t("about.problem.title")}
        </h2>
        <ul className="space-y-3">
          {[
            { icon: "📚", text: t("about.problem.p1") },
            { icon: "📝", text: t("about.problem.p2") },
            { icon: "🗣️", text: t("about.problem.p3") },
            { icon: "🗺️", text: t("about.problem.p4") },
            { icon: "⚠️", text: t("about.problem.p5") },
          ].map((p, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="text-xl flex-shrink-0">{p.icon}</div>
              <div className="text-slate-700">{p.text}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* The Solution */}
      <section className="card border-l-4 border-l-leaf-500">
        <h2 className="text-xl font-bold text-navy-900 mb-3">
          ✅ {t("about.solution.title")}
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          {t("about.solution.p1")}
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: "🎯", title: t("about.solution.f1.title"), desc: t("about.solution.f1.desc") },
            { icon: "🧮", title: t("about.solution.f2.title"), desc: t("about.solution.f2.desc") },
            { icon: "🏦", title: t("about.solution.f3.title"), desc: t("about.solution.f3.desc") },
            { icon: "🌐", title: t("about.solution.f4.title"), desc: t("about.solution.f4.desc") },
            { icon: "📖", title: t("about.solution.f5.title"), desc: t("about.solution.f5.desc") },
            { icon: "🛡️", title: t("about.solution.f6.title"), desc: t("about.solution.f6.desc") },
          ].map((f, i) => (
            <div key={i} className="bg-leaf-500/5 border border-leaf-500/20 rounded-lg p-3">
              <div className="font-bold text-navy-900 text-sm">
                {f.icon} {f.title}
              </div>
              <div className="text-xs text-slate-700 mt-1">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Impact */}
      <section className="card bg-gradient-to-br from-navy-700 to-navy-900 text-white">
        <h2 className="text-xl font-bold mb-4">{t("about.impact.title")}</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-saffron-500">15+</div>
            <div className="text-xs text-slate-200 mt-1">{t("about.impact.schemes")}</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-saffron-500">3</div>
            <div className="text-xs text-slate-200 mt-1">{t("about.impact.languages")}</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-saffron-500">3</div>
            <div className="text-xs text-slate-200 mt-1">{t("about.impact.steps")}</div>
          </div>
        </div>
      </section>

      <div className="text-center">
        <Link to="/schemes" className="btn-primary">
          {t("about.cta")}
        </Link>
      </div>
    </div>
  );
}

function FlowBox({ label, sub, highlight }) {
  return (
    <div
      className={`flex-1 rounded-lg p-3 text-center border-2 ${
        highlight
          ? "bg-saffron-500 text-white border-saffron-600"
          : "bg-white border-navy-500/30 text-navy-900"
      }`}
    >
      <div className="font-bold text-sm">{label}</div>
      <div className={`text-xs mt-0.5 ${highlight ? "text-white/90" : "text-slate-600"}`}>
        {sub}
      </div>
    </div>
  );
}

function Arrow() {
  return <div className="text-navy-700 font-bold text-xl hidden sm:block">→</div>;
}