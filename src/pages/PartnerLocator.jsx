import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import PartnerMap from "../components/PartnerMap.jsx";
import { partnersApi, geoApi, schemesApi } from "../lib/api.js";
import { useFetch } from "../hooks/useFetch.js";
import { useT } from "../i18n/LanguageContext.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

// Health presentation lives client-side; the server owns the actual exclusion
// rule (High-NPA partners never reach `partners`, only `excluded`).
const HEALTH = { HEALTHY: "Healthy", CAUTION: "Caution", HIGH_NPA: "High NPA" };

function healthColor(h) {
  if (h === HEALTH.HEALTHY) return "bg-leaf-500/10 text-leaf-600 border-leaf-500/30";
  if (h === HEALTH.CAUTION) return "bg-saffron-500/10 text-saffron-600 border-saffron-500/30";
  return "bg-red-500/10 text-red-600 border-red-500/30";
}
function healthIcon(h) {
  if (h === HEALTH.HEALTHY) return "🟢";
  if (h === HEALTH.CAUTION) return "🟡";
  return "🔴";
}

export default function PartnerLocator() {
  const t = useT();
  const location = useLocation();
  const incomingSchemeId = location.state?.schemeId;

  const [userLocation, setUserLocation] = useState(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationError, setLocationError] = useState("");
  const [schemeId, setSchemeId] = useState(incomingSchemeId || "");
  const [sortBy, setSortBy] = useState("distance"); // "distance" | "health"
  const [isLocating, setIsLocating] = useState(true);

  // ---------- Geolocation (browser) ----------
  useEffect(() => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            label: "Your current location",
          });
          setIsLocating(false);
        },
        () => {
          setLocationError("Location access denied. Enter your city or pincode below.");
          setIsLocating(false);
        },
        { timeout: 5000 }
      );
    } else {
      setLocationError("Geolocation not supported. Enter your city or pincode below.");
      setIsLocating(false);
    }
  }, []);

  // ---------- Location search (server geocoder) ----------
  const handleLocationSearch = async () => {
    try {
      const { place } = await geoApi.lookup(locationQuery);
      if (place) {
        setUserLocation({ lat: place.lat, lng: place.lng, label: place.label });
        setLocationError("");
      } else {
        setLocationError("City not found. Try a major city name or 6-digit pincode.");
      }
    } catch {
      setLocationError(t("common.error"));
    }
  };

  // ---------- Partners (server does distance + High-NPA exclusion) ----------
  const { data, loading } = useFetch(
    (opts) =>
      partnersApi.list(
        {
          schemeId: schemeId || undefined,
          lat: userLocation?.lat,
          lng: userLocation?.lng,
          sort: sortBy,
        },
        opts
      ),
    [schemeId, userLocation?.lat, userLocation?.lng, sortBy]
  );

  const partners = data?.partners ?? [];
  const excluded = data?.excluded ?? [];

  // Scheme name for the context banner (only when filtering by a scheme).
  const { data: schemeData } = useFetch(
    (opts) => schemesApi.get(schemeId, opts),
    [schemeId],
    { enabled: !!schemeId }
  );
  const selectedScheme = schemeData?.scheme ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900">{t("partner.title")}</h1>
        <p className="text-slate-600 mt-1">{t("partner.subtitle")}</p>
      </div>

      {/* Scheme context banner */}
      {schemeId && (
        <div className="card bg-navy-50 border-navy-500/30 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-navy-700 uppercase tracking-wide">
              {t("partner.showingFor")}
            </div>
            <div className="font-bold text-navy-900 text-lg">
              {selectedScheme?.name ?? schemeId}
            </div>
            <div className="text-sm text-slate-600 mt-0.5">
              {partners.length} {t("partner.canProcess")}
            </div>
          </div>
          <button
            onClick={() => setSchemeId("")}
            className="btn-ghost !py-2 !px-4 !min-h-[40px] text-sm"
          >
            {t("partner.clearFilter")}
          </button>
        </div>
      )}

      {/* Location input */}
      <div className="card">
        <label className="block font-semibold mb-2">{t("partner.location")}</label>
        {isLocating ? (
          <LoadingSpinner size="sm" label={t("partner.locating")} />
        ) : (
          <>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder={t("partner.locationPlaceholder")}
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLocationSearch()}
              />
              <button onClick={handleLocationSearch} className="btn-primary !py-2 !px-6">
                {t("partner.search")}
              </button>
            </div>
            {locationError && (
              <div className="text-sm text-saffron-600 mt-2">⚠️ {locationError}</div>
            )}
            {userLocation && !locationError && (
              <div className="text-sm text-leaf-600 mt-2">
                ✓ {t("partner.near")} <b>{userLocation.label}</b>
              </div>
            )}
          </>
        )}
      </div>

      {/* Excluded partners note */}
      {excluded.length > 0 && (
        <div className="card bg-red-500/5 border-red-500/20">
          <div className="flex items-start gap-2">
            <div className="text-xl">⛔</div>
            <div>
              <div className="font-semibold text-red-700">
                {excluded.length} {t("partner.excludedTitle")}
              </div>
              <div className="text-sm text-slate-700 mt-1">{t("partner.excludedDesc")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Map + List */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Map */}
        <div className="card !p-0 overflow-hidden">
          <PartnerMap userLocation={userLocation} partners={partners} />
        </div>

        {/* List */}
        <div className="space-y-4">
          {/* Sort controls */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">
              {partners.length} {t("partner.found")}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy("distance")}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                  sortBy === "distance"
                    ? "bg-navy-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {t("partner.sort.nearest")}
              </button>
              <button
                onClick={() => setSortBy("health")}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                  sortBy === "health"
                    ? "bg-navy-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {t("partner.sort.health")}
              </button>
            </div>
          </div>

          {/* Partner cards */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {loading && <LoadingSpinner label={t("common.loading")} />}
            {!loading && partners.length === 0 && (
              <div className="card text-center text-slate-600 py-10">
                {userLocation ? t("partner.noMatch") : t("partner.enterLocation")}
              </div>
            )}
            {partners.map((p) => (
              <div key={p.id} className="card">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-navy-50 text-navy-700 grid place-items-center font-bold text-xl flex-shrink-0">
                    🏦
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="font-bold text-navy-900 text-lg leading-tight">
                        {p.name}
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full border whitespace-nowrap ${healthColor(
                          p.health
                        )}`}
                      >
                        {healthIcon(p.health)} {p.health}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {p.type} · {p.city}, {p.state}
                    </div>

                    {p.distanceLabel && (
                      <div className="text-sm font-semibold text-navy-700 mt-2">
                        📍 {p.distanceLabel} {t("partner.away")}
                      </div>
                    )}

                    <div className="mt-3 space-y-1 text-sm">
                      <div>
                        📞{" "}
                        <a href={`tel:${p.contact}`} className="text-navy-700 font-semibold">
                          {p.contact}
                        </a>
                      </div>
                      <div>
                        🌐{" "}
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-navy-700 underline break-all"
                        >
                          {p.url.replace("https://", "")}
                        </a>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary flex-1 !py-2 !min-h-[40px] text-sm"
                      >
                        {t("partner.directions")}
                      </a>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost flex-1 !py-2 !min-h-[40px] text-sm"
                      >
                        {t("partner.website")}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
