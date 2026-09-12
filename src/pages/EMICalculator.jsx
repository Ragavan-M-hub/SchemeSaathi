import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { emiApi, ApiError } from "../lib/api.js";
import { formatINR } from "../data/schemes.js";
import { useT } from "../i18n/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const fmt = formatINR;

// The server returns warnings as { code, value } so the wording can be localised
// here rather than baked into the API response.
function warningText(w) {
  const v = w.value;
  switch (w.code) {
    case "loan_above_max": return `Loan exceeds scheme maximum of ${fmt(v)}`;
    case "loan_below_min": return `Loan is below scheme minimum of ${fmt(v)}`;
    case "rate_above_max": return `Rate exceeds scheme maximum of ${v}%`;
    case "rate_below_min": return `Rate is below scheme minimum of ${v}%`;
    case "tenure_above_max": return `Tenure exceeds scheme maximum of ${v} years`;
    case "moratorium_covers_tenure": return `Moratorium covers the full tenure — no principal will be repaid`;
    default: return w.code;
  }
}

const EMPTY = { emi: 0, totalInterest: 0, totalPayment: 0, moratoriumInterest: 0, moratoriumPayment: 0, yearly: [], schedule: [] };

export default function EMICalculator() {
  const t = useT();
  const { user } = useAuth();
  const location = useLocation();
  const scheme = location.state?.scheme; // passed from Scheme Recommender

  // ---------- Form state (auto-filled from scheme if available) ----------
  const [loan, setLoan] = useState(scheme?.loan?.max ?? 100000);
  const [rate, setRate] = useState(scheme ? (scheme.interest.min + scheme.interest.max) / 2 : 8);
  const [tenure, setTenure] = useState(scheme?.tenureYears ?? 5);
  const [moratorium, setMoratorium] = useState(scheme?.moratoriumMonths ?? 0);
  const [showSchedule, setShowSchedule] = useState(false);

  const [result, setResult] = useState(EMPTY);
  const [warnings, setWarnings] = useState([]);

  // ---------- Saved scenarios (compare 2–3 plans side by side) ----------
  const [scenarios, setScenarios] = useState([]);
  const [scenariosLoading, setScenariosLoading] = useState(false);
  const [scenarioLabel, setScenarioLabel] = useState("");
  const [savingScenario, setSavingScenario] = useState(false);
  const [scenarioError, setScenarioError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const loadScenarios = useCallback(() => {
    if (!user) return;
    setScenariosLoading(true);
    emiApi
      .listScenarios()
      .then((res) => setScenarios(res.scenarios ?? []))
      .catch(() => setScenarios([]))
      .finally(() => setScenariosLoading(false));
  }, [user]);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  async function handleSaveScenario() {
    setSavingScenario(true);
    setScenarioError(null);
    try {
      await emiApi.saveScenario({
        principal: Number(loan) || 0,
        annualRate: Number(rate) || 0,
        tenureYears: Number(tenure) || 1,
        moratoriumMonths: Number(moratorium) || 0,
        schemeId: scheme?.id,
        label: scenarioLabel.trim() || scheme?.name || t("emi.scenarios.defaultLabel"),
      });
      setScenarioLabel("");
      loadScenarios();
    } catch (err) {
      setScenarioError(err instanceof ApiError ? err.message : t("emi.scenarios.saveError"));
    } finally {
      setSavingScenario(false);
    }
  }

  async function handleDeleteScenario(id) {
    setScenarios((prev) => prev.filter((s) => s.id !== id)); // optimistic
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
    try {
      await emiApi.deleteScenario(id);
    } catch {
      loadScenarios(); // roll back on failure
    }
  }

  function toggleSelected(id) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((sid) => sid !== id)
        : prev.length >= 3
        ? prev // cap comparison at 3 scenarios so the table stays readable
        : [...prev, id]
    );
  }

  const compared = scenarios.filter((s) => selectedIds.includes(s.id));

  // Re-sync if a different scheme is passed in (e.g. user navigates back with new context)
  useEffect(() => {
    if (scheme) {
      setLoan(scheme.loan.max);
      setRate((scheme.interest.min + scheme.interest.max) / 2);
      setTenure(scheme.tenureYears);
      setMoratorium(scheme.moratoriumMonths);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme?.id]);

  // ---------- Computation (debounced, server-side) ----------
  // A short debounce keeps slider drags from firing a request per pixel while
  // still feeling instant. The AbortController drops any superseded response.
  useEffect(() => {
    const controller = new AbortController();
    const handle = setTimeout(() => {
      emiApi
        .calculate(
          {
            principal: Number(loan) || 0,
            annualRate: Number(rate) || 0,
            tenureYears: Number(tenure) || 1,
            moratoriumMonths: Number(moratorium) || 0,
            schemeId: scheme?.id,
            includeSchedule: true,
          },
          { signal: controller.signal }
        )
        .then((res) => {
          setResult(res);
          setWarnings(res.warnings ?? []);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setResult(EMPTY);
        });
    }, 250);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [loan, rate, tenure, moratorium, scheme?.id]);

  const schedule = result.schedule ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900">{t("emi.title")}</h1>
        <p className="text-slate-600 mt-1">{t("emi.subtitle")}</p>
      </div>

      {/* Scheme context banner */}
      {scheme && (
        <div className="card bg-navy-50 border-navy-500/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-navy-700 uppercase tracking-wide">
                {t("emi.prefilled")}
              </div>
              <div className="font-bold text-navy-900 text-lg">{scheme.name}</div>
              <div className="text-sm text-slate-600 mt-1">
                {t("emi.loan")}: <b>{formatINR(scheme.loan.min)} – {formatINR(scheme.loan.max)}</b> · {t("emi.rate")}: <b>{scheme.interest.min}–{scheme.interest.max}%</b> · {t("emi.moratorium")}: <b>{scheme.moratoriumMonths} {t("recommender.results.months")}</b>
              </div>
            </div>
            <div className="text-xs text-slate-500">{t("emi.override")}</div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="card bg-saffron-500/5 border-saffron-500/30">
          <div className="font-semibold text-saffron-600 mb-1">{t("emi.warn")}</div>
          <ul className="text-sm text-slate-700 space-y-0.5">
            {warnings.map((w, i) => <li key={i}>• {warningText(w)}</li>)}
          </ul>
        </div>
      )}

      {/* Inputs + Summary */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Inputs (3 cols) */}
        <div className="lg:col-span-3 card space-y-5">
          <LoanInput
            label={t("emi.loan")}
            value={loan}
            onChange={setLoan}
            step={10000}
            min={10000}
            max={10000000}
            hint={scheme ? `${t("recommender.results.loanRange")}: ${fmt(scheme.loan.min)} – ${fmt(scheme.loan.max)}` : t("emi.loan")}
          />
          <RateInput
            value={rate}
            onChange={setRate}
            label={t("emi.rate")}
            hint={scheme ? `${scheme.interest.min}–${scheme.interest.max}% p.a.` : t("emi.rate")}
          />
          <NumberSlider
            label={t("emi.tenure")}
            value={tenure}
            onChange={setTenure}
            min={1} max={15} step={1}
            hint={t("emi.tenureHint")}
          />
          <NumberSlider
            label={t("emi.moratorium")}
            value={moratorium}
            onChange={setMoratorium}
            min={0} max={tenure * 12} step={1}
            hint={t("emi.moratoriumHint")}
          />
        </div>

        {/* Summary (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card bg-navy-700 text-white">
            <div className="text-sm text-slate-200">{t("emi.monthlyEmi")}</div>
            <div className="text-4xl font-bold mt-2">{fmt(result.emi)}</div>
            <div className="text-xs text-slate-300 mt-1">
              {moratorium > 0
                ? `${fmt(result.moratoriumPayment)}${t("emi.interestOnly")}`
                : t("emi.fromMonth1")}
            </div>
          </div>

          <div className="card space-y-3">
            <SummaryRow label={t("emi.principal")} value={fmt(loan)} />
            <SummaryRow label={t("emi.totalInterest")} value={fmt(result.totalInterest)} accent="saffron" />
            <SummaryRow label={t("emi.totalRepay")} value={fmt(result.totalPayment)} bold />
            {moratorium > 0 && (
              <SummaryRow
                label={`${t("emi.moratoriumInterest")} (${moratorium} mo)`}
                value={fmt(result.moratoriumInterest)}
                small
              />
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h2 className="font-bold text-navy-900 text-lg mb-1">{t("emi.chart.title")}</h2>
        <p className="text-sm text-slate-500 mb-4">{t("emi.chart.subtitle")}</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={result.yearly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" stroke="#475569" fontSize={12} />
              <YAxis
                stroke="#475569"
                fontSize={12}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v) => fmt(v)}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="principal" name={t("emi.chart.principal")} stackId="a" fill="#1e3a8a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="interest" name={t("emi.chart.interest")} stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-600">
          <div><span className="inline-block w-3 h-3 bg-navy-700 rounded-sm mr-1"></span>{t("emi.chart.principal")}</div>
          <div><span className="inline-block w-3 h-3 bg-saffron-500 rounded-sm mr-1"></span>{t("emi.chart.interest")}</div>
          {moratorium > 0 && <div className="text-saffron-600">{t("emi.chart.moratoriumNote")}</div>}
        </div>
      </div>

      {/* Amortization schedule */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-navy-900 text-lg">{t("emi.schedule.title")}</h2>
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="btn-ghost !py-2 !min-h-[40px] text-sm"
          >
            {showSchedule ? t("emi.schedule.hide") : t("emi.schedule.show")}
          </button>
        </div>

        {showSchedule && (
          <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left text-slate-600">
                  <th className="px-3 py-2">{t("emi.schedule.month")}</th>
                  <th className="px-3 py-2 text-right">{t("emi.schedule.payment")}</th>
                  <th className="px-3 py-2 text-right">{t("emi.schedule.principal")}</th>
                  <th className="px-3 py-2 text-right">{t("emi.schedule.interest")}</th>
                  <th className="px-3 py-2 text-right">{t("emi.schedule.balance")}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr
                    key={row.month}
                    className={`border-t ${row.isMoratorium ? "bg-saffron-500/5" : ""}`}
                  >
                    <td className="px-3 py-2 font-medium">
                      {row.month}
                      {row.isMoratorium && <span className="ml-1 text-xs text-saffron-600">{t("emi.schedule.grace")}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{fmt(row.payment)}</td>
                    <td className="px-3 py-2 text-right text-navy-700">{fmt(row.principal)}</td>
                    <td className="px-3 py-2 text-right text-saffron-600">{fmt(row.interest)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!showSchedule && (
          <div className="text-sm text-slate-600">
            {schedule.length} {t("emi.schedule.entries")}
          </div>
        )}
      </div>

      {/* Save & compare scenarios */}
      <div className="card">
        <h2 className="font-bold text-navy-900 text-lg mb-1">{t("emi.scenarios.title")}</h2>
        <p className="text-sm text-slate-500 mb-4">{t("emi.scenarios.subtitle")}</p>

        {!user && (
          <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
            {t("emi.scenarios.signInPrompt")}
          </div>
        )}

        {user && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <input
                type="text"
                className="input flex-1 min-w-[160px]"
                placeholder={t("emi.scenarios.labelPlaceholder")}
                value={scenarioLabel}
                onChange={(e) => setScenarioLabel(e.target.value)}
                maxLength={60}
              />
              <button
                onClick={handleSaveScenario}
                disabled={savingScenario}
                className="btn-primary !min-h-[40px] !py-2 !px-4 text-sm disabled:opacity-50"
              >
                {savingScenario ? t("emi.scenarios.saving") : t("emi.scenarios.saveCurrent")}
              </button>
            </div>

            {scenarioError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-4">
                {scenarioError}
              </div>
            )}

            {scenariosLoading && <div className="text-sm text-slate-500">{t("emi.scenarios.loading")}</div>}

            {!scenariosLoading && scenarios.length === 0 && (
              <div className="text-sm text-slate-500">{t("emi.scenarios.empty")}</div>
            )}

            {!scenariosLoading && scenarios.length > 0 && (
              <>
                <div className="text-xs text-slate-500 mb-2">{t("emi.scenarios.selectHint")}</div>
                <div className="space-y-2">
                  {scenarios.map((s) => (
                    <label
                      key={s.id}
                      className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                        selectedIds.includes(s.id)
                          ? "border-navy-500 bg-navy-50/60"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id)}
                        onChange={() => toggleSelected(s.id)}
                        className="w-4 h-4 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-navy-900 truncate">
                          {s.label}
                          {s.schemeName && <span className="text-slate-400 font-normal"> · {s.schemeName}</span>}
                        </div>
                        <div className="text-xs text-slate-500">
                          {fmt(s.principal)} · {s.annualRate}% · {s.tenureYears}{t("emi.scenarios.years")} · {t("emi.monthlyEmi")}: {fmt(s.emi)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteScenario(s.id);
                        }}
                        className="text-slate-400 hover:text-red-600 text-lg leading-none flex-shrink-0 px-1"
                        aria-label={t("emi.scenarios.delete")}
                      >
                        ×
                      </button>
                    </label>
                  ))}
                </div>
              </>
            )}

            {compared.length >= 2 && (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-slate-600">
                      <th className="px-3 py-2">{t("emi.scenarios.compare.metric")}</th>
                      {compared.map((s) => (
                        <th key={s.id} className="px-3 py-2 text-right text-navy-900">{s.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <CompareRow label={t("emi.principal")} values={compared.map((s) => fmt(s.principal))} />
                    <CompareRow label={t("emi.rate")} values={compared.map((s) => `${s.annualRate}%`)} />
                    <CompareRow label={t("emi.tenure")} values={compared.map((s) => `${s.tenureYears} ${t("emi.scenarios.years")}`)} />
                    <CompareRow label={t("emi.monthlyEmi")} values={compared.map((s) => fmt(s.emi))} bold />
                    <CompareRow label={t("emi.totalInterest")} values={compared.map((s) => fmt(s.totalInterest))} />
                    <CompareRow label={t("emi.totalRepay")} values={compared.map((s) => fmt(s.totalPayment))} bold />
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CompareRow({ label, values, bold }) {
  return (
    <tr className="border-t">
      <td className={`px-3 py-2 text-slate-600 ${bold ? "font-semibold" : ""}`}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`px-3 py-2 text-right ${bold ? "font-bold text-navy-900" : "text-slate-800"}`}>
          {v}
        </td>
      ))}
    </tr>
  );
}

/* ---------- Reusable input components ---------- */

function LoanInput({ label, value, onChange, step, min, max, hint }) {
  return (
    <div>
      <label className="block font-semibold mb-2">{label}</label>
      <input
        type="number"
        className="input"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
      <input
        type="range"
        className="w-full mt-2"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="text-xs text-slate-500 mt-1">{hint}</div>
    </div>
  );
}

function RateInput({ value, onChange, label, hint }) {
  return (
    <div>
      <label className="block font-semibold mb-2">{label}</label>
      <input
        type="number"
        step="0.1"
        className="input"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
      <input
        type="range"
        className="w-full mt-2"
        min="0" max="24" step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="text-xs text-slate-500 mt-1">{hint}</div>
    </div>
  );
}

function NumberSlider({ label, value, onChange, min, max, step, hint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="font-semibold">{label}</label>
        <span className="text-navy-700 font-bold">{value}</span>
      </div>
      <input
        type="range"
        className="w-full"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="text-xs text-slate-500 mt-1">{hint}</div>
    </div>
  );
}

function SummaryRow({ label, value, accent, bold, small }) {
  const color =
    accent === "saffron" ? "text-saffron-600"
    : bold ? "text-navy-900"
    : "text-slate-800";
  return (
    <div className={`flex justify-between items-baseline ${small ? "text-xs" : ""} ${bold ? "border-t pt-2 mt-1" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${color} ${bold ? "text-xl" : ""}`}>{value}</span>
    </div>
  );
}
