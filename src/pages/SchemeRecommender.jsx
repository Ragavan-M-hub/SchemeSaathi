import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useT } from "../i18n/LanguageContext.jsx";
import { useAppContext } from "../context/AppContext.jsx";
import { recommendationsApi, ApiError } from "../lib/api.js";
import { formatINR } from "../data/schemes.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { CardSkeleton } from "../components/Skeleton.jsx";

// ---------- Static option lists ----------
const PURPOSES = [
  { value: "self-employment", labelKey: "recommender.q1.self", icon: "🏪" },
  { value: "higher-education", labelKey: "recommender.q1.edu", icon: "🎓" },
  { value: "skill-training", labelKey: "recommender.q1.skill", icon: "🛠️" },
];

const TYPES_BY_PURPOSE = {
  "self-employment": [
    "Retail shop", "Tailoring / boutique", "Food stall / canteen",
    "Repair & service kiosk", "Agri-allied activity",
    "Small manufacturing unit", "Transport (commercial vehicle)",
    "Cold storage / warehouse", "Beauty parlour / salon",
    "Food processing (pickles, papad)", "Handicraft / handloom",
    "Day-care / pre-school", "Working capital for existing shop",
  ],
  "higher-education": [
    "Engineering / Medical in India", "MBA / Management courses",
    "Studies abroad (Master's / PhD)", "Professional courses (CA / CS / CMA)",
    "Vocational diplomas (recognised)",
  ],
  "skill-training": [
    "PMKVY / skill courses", "ITI / polytechnic diplomas",
    "Driving licence (commercial)", "Computer / digital literacy",
    "Healthcare worker training (GNM/ANM)",
  ],
};

const EDUCATION_LEVELS = [
  { value: "none", labelKey: "recommender.q4.edu.none" },
  { value: "10th", labelKey: "recommender.q4.edu.10" },
  { value: "12th", labelKey: "recommender.q4.edu.12" },
  { value: "graduate", labelKey: "recommender.q4.edu.grad" },
];

const GENDERS = [
  { value: "female", labelKey: "recommender.q4.gender.f" },
  { value: "male", labelKey: "recommender.q4.gender.m" },
  { value: "other", labelKey: "recommender.q4.gender.o" },
];

const STEPS = ["Purpose", "Type", "Cost & Income", "Your Details", "Results"];

export default function SchemeRecommender() {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const { state, update, markStep } = useAppContext();

  // Only pre-fill previous answers when arriving via the Home page's "Edit"
  // link (state.fromJourney) or a launched persona — any other way of
  // reaching this page (top nav, hero CTA, direct URL, etc.) starts blank.
  const shouldPrefill = Boolean(location.state?.fromJourney) || Boolean(state._personaActive);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() =>
    shouldPrefill
      ? {
          purpose: state.purpose || "",
          projectType: state.projectType || "",
          cost: state.cost || "",
          income: state.income || "",
          education: state.education || "",
          gender: state.gender || "",
        }
      : { purpose: "", projectType: "", cost: "", income: "", education: "", gender: "" }
  );
  const [results, setResults] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [matchError, setMatchError] = useState(null);

  // Auto-run matcher if a persona was launched from Home
  useEffect(() => {
    if (state._personaActive && !results) {
      handleNext(true); // silent run, no UI delay
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state._personaActive]);

  const updateField = (k, v) => setForm({ ...form, [k]: v });

  const canNext = () => {
    if (step === 0) return form.purpose !== "";
    if (step === 1) return form.projectType !== "";
    if (step === 2) return Number(form.cost) > 0 && Number(form.income) >= 0;
    if (step === 3) return form.education !== "" && form.gender !== "";
    return true;
  };

  const handleNext = async (silent = false) => {
    if (step === 3 || silent) {
      setIsThinking(true);
      setMatchError(null);
      setStep(4);
      update(form);
      markStep("recommender");

      try {
        // The server runs the matcher (and persists the run for signed-in users).
        const { ranked } = await recommendationsApi.create({
          purpose: form.purpose,
          projectType: form.projectType || undefined,
          cost: form.cost === "" ? undefined : Number(form.cost),
          income: form.income === "" ? undefined : Number(form.income),
          education: form.education || undefined,
          gender: form.gender || undefined,
        });
        setResults(ranked);
      } catch (err) {
        setResults([]);
        setMatchError(err instanceof ApiError ? err.message : t("common.error"));
      } finally {
        setIsThinking(false);
      }
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step === 4) {
      setResults(null);
      setStep(3);
    } else if (step > 0) {
      setStep(step - 1);
    }
  };

  const restart = () => {
    setForm({ purpose: "", projectType: "", cost: "", income: "", education: "", gender: "" });
    setResults(null);
    setStep(0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-navy-900">{t("recommender.title")}</h1>
        <p className="text-slate-600 mt-1">{t("recommender.subtitle")}</p>
      </div>

      {/* Progress bar */}
      <div className="card !p-4">
        <div className="flex items-center justify-between mb-2 text-xs font-semibold text-slate-500">
          <span>
            {t("recommender.step.of")} {Math.min(step + 1, 4)} {t("recommender.step.of")} 4
          </span>
          <span>{STEPS[Math.min(step, 3)]}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-navy-700 transition-all duration-300"
            style={{ width: `${Math.min(step, 3) * 33.33}%` }}
          />
        </div>
      </div>

      {/* Form body */}
      <div className="card min-h-[320px]">
        {step === 0 && (
          <StepWrapper title={t("recommender.q1.title")} subtitle={t("recommender.q1.subtitle")}>
            <div className="grid gap-3">
              {PURPOSES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => updateField("purpose", p.value)}
                  className={`text-left p-5 rounded-xl border-2 transition flex items-center gap-4 ${
                    form.purpose === p.value
                      ? "border-navy-700 bg-navy-50"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <div className="text-3xl">{p.icon}</div>
                  <div className="font-semibold text-base">{t(p.labelKey)}</div>
                </button>
              ))}
            </div>
          </StepWrapper>
        )}

        {step === 1 && (
          <StepWrapper title={t("recommender.q2.title")} subtitle={t("recommender.q2.subtitle")}>
            <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-1">
              {(TYPES_BY_PURPOSE[form.purpose] || []).map((type) => (
                <button
                  key={type}
                  onClick={() => updateField("projectType", type)}
                  className={`text-left p-4 rounded-lg border-2 transition ${
                    form.projectType === type
                      ? "border-navy-700 bg-navy-50 font-semibold"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </StepWrapper>
        )}

        {step === 2 && (
          <StepWrapper title={t("recommender.q3.title")} subtitle={t("recommender.q3.subtitle")}>
            <div className="space-y-5">
              <div>
                <label className="block font-semibold mb-2">{t("recommender.q3.cost")}</label>
                <input
                  type="number"
                  className="input"
                  placeholder={t("recommender.q3.cost.placeholder")}
                  value={form.cost}
                  onChange={(e) => updateField("cost", e.target.value)}
                />
                {form.cost && (
                  <div className="text-sm text-slate-500 mt-1">= {formatINR(Number(form.cost))}</div>
                )}
              </div>
              <div>
                <label className="block font-semibold mb-2">{t("recommender.q3.income")}</label>
                <input
                  type="number"
                  className="input"
                  placeholder={t("recommender.q3.income.placeholder")}
                  value={form.income}
                  onChange={(e) => updateField("income", e.target.value)}
                />
                {form.income && (
                  <div className="text-sm text-slate-500 mt-1">
                    = {formatINR(Number(form.income))} {t("recommender.q3.perYear")}
                  </div>
                )}
              </div>
            </div>
          </StepWrapper>
        )}

        {step === 3 && (
          <StepWrapper title={t("recommender.q4.title")} subtitle={t("recommender.q4.subtitle")}>
            <div className="space-y-5">
              <div>
                <label className="block font-semibold mb-2">{t("recommender.q4.edu")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {EDUCATION_LEVELS.map((e) => (
                    <button
                      key={e.value}
                      onClick={() => updateField("education", e.value)}
                      className={`p-4 rounded-lg border-2 transition text-sm font-medium ${
                        form.education === e.value
                          ? "border-navy-700 bg-navy-50 text-navy-900"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      {t(e.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-2">{t("recommender.q4.gender")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {GENDERS.map((g) => (
                    <button
                      key={g.value}
                      onClick={() => updateField("gender", g.value)}
                      className={`p-4 rounded-lg border-2 transition text-sm font-medium ${
                        form.gender === g.value
                          ? "border-navy-700 bg-navy-50 text-navy-900"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      {t(g.labelKey)}
                    </button>
                  ))}
                </div>
                {form.gender === "female" && (
                  <div className="mt-3 text-sm text-leaf-600 bg-leaf-500/5 border border-leaf-500/20 rounded-lg p-3">
                    {t("recommender.q4.mahilaHint")}
                  </div>
                )}
              </div>
            </div>
          </StepWrapper>
        )}

        {step === 4 && isThinking && (
          <div className="space-y-4 py-8">
            <LoadingSpinner size="lg" label={t("recommender.thinking")} />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {step === 4 && !isThinking && (
          <ResultsView results={results} navigate={navigate} error={matchError} />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3">
        {step > 0 && step < 4 && (
          <button onClick={handleBack} className="btn-ghost flex-1">
            {t("recommender.btn.back")}
          </button>
        )}
        {step < 4 && (
          <button
            onClick={() => handleNext(false)}
            disabled={!canNext()}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 3 ? t("recommender.btn.show") : t("recommender.btn.next")}
          </button>
        )}
        {step === 4 && !isThinking && (
          <>
            <button onClick={handleBack} className="btn-ghost flex-1">
              {t("recommender.btn.edit")}
            </button>
            <button onClick={restart} className="btn-primary flex-1">
              {t("recommender.btn.restart")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Small presentational pieces ---------- */
function StepWrapper({ title, subtitle, children }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-navy-900">{title}</h2>
      <p className="text-slate-600 mt-1 mb-5">{subtitle}</p>
      {children}
    </div>
  );
}

function ResultsView({ results, navigate, error }) {
  const t = useT();

  if (error) {
    return (
      <div className="text-center py-10">
        <div className="text-5xl mb-3">⚠️</div>
        <h2 className="text-xl font-bold text-navy-900">{t("common.error")}</h2>
        <p className="text-slate-600 mt-2 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-5xl mb-3">🤔</div>
        <h2 className="text-xl font-bold text-navy-900">{t("recommender.results.none")}</h2>
        <p className="text-slate-600 mt-2 max-w-md mx-auto">
          {t("recommender.results.noneDesc")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-navy-900">
          {t("recommender.results.top")}
        </h2>
        <p className="text-slate-600 mt-1 text-sm">
          {t("recommender.results.subtitle")}
        </p>
      </div>

      <div className="space-y-4">
        {results.map((s, idx) => {
          return (
            <div key={s.id} className="card border-l-4 border-l-navy-700">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-navy-700 text-white grid place-items-center font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-bold text-navy-900 text-lg leading-tight">
                      {s.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.nodalAgency}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">{t("recommender.results.covers")}</div>
                  <div
                    className={`text-lg font-bold ${
                      s.coveragePct >= 100 ? "text-leaf-600" : "text-saffron-600"
                    }`}
                  >
                    {s.coveragePct}%
                  </div>
                </div>
              </div>

              {/* Key numbers */}
              <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                <Stat
                  label={t("recommender.results.loanRange")}
                  value={`${formatINR(s.loan.min)} – ${formatINR(s.loan.max)}`}
                />
                <Stat
                  label={t("recommender.results.interest")}
                  value={`${s.interest.min}–${s.interest.max}%`}
                />
                <Stat
                  label={t("recommender.results.moratorium")}
                  value={`${s.moratoriumMonths} ${t("recommender.results.months")}`}
                />
              </div>

              {/* Description */}
              <p className="text-slate-700 mt-4 text-sm">{s.description}</p>

              {/* Why this fits */}
              <div className="mt-4 bg-navy-50/60 border border-navy-500/20 rounded-lg p-3">
                <div className="text-xs font-bold text-navy-700 uppercase tracking-wide mb-2">
                  {t("recommender.results.why")}
                </div>
                <ul className="space-y-1">
                  {s.reasons.slice(0, 4).map((r, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="text-leaf-600 mt-0.5">✓</span>
                      <span>{typeof r === "string" ? r : r.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <a
                  href={s.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary flex-1"
                >
                  {t("recommender.results.apply")}
                </a>
                <button
                  onClick={() => navigate("/emi", { state: { scheme: s } })}
                  className="btn-accent flex-1"
                >
                  {t("recommender.results.checkEmi")}
                </button>
                <button
                  onClick={() => navigate("/partners", { state: { schemeId: s.id } })}
                  className="btn-ghost flex-1"
                >
                  {t("recommender.results.seePartners")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold text-navy-900 text-sm mt-0.5">{value}</div>
    </div>
  );
}