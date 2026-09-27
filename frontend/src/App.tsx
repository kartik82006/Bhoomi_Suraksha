import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { getHazardZones, getHabitations, getPrioritization, getSites, getSummary, type SimulationResult } from "./api";
import { BrandMark } from "./components/BrandMark";
import { DetailPanel } from "./components/DetailPanel";
import { Filters } from "./components/Filters";
import { Legend } from "./components/Legend";
import { LoginScreen } from "./components/LoginScreen";
import { MapView } from "./components/MapView";
import { PrioritizationPanel } from "./components/PrioritizationPanel";
import { SiteDetail, type SiteFeatureProperties } from "./components/SiteDetail";
import { WhatIfSlider } from "./components/WhatIfSlider";
import { LandingPage } from "./components/LandingPage";
import { useI18n } from "./i18n";
import { exportPrioritizationCsv, exportPrioritizationGeoJson } from "./lib/export";
import type { HazardType, PrioritizationItem, Session, Summary, Tier } from "./types";
import { getRelocationSiteById } from "./data/relocationSites";

const ALL_HAZARDS_VISIBLE: Record<HazardType, boolean> = {
  landslide: true,
  flood: true,
  coastal_erosion: true,
  cloudburst: true,
};

function App() {
  const { t, lang, setLang, loading: langLoading } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [simResults, setSimResults] = useState<SimulationResult["results"] | null>(null);
  const [hazardZones, setHazardZones] = useState<GeoJSON.FeatureCollection | null>(null);
  const [habitations, setHabitations] = useState<GeoJSON.FeatureCollection | null>(null);
  const [sites, setSites] = useState<GeoJSON.FeatureCollection | null>(null);
  const [prioritization, setPrioritization] = useState<PrioritizationItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedRelocationSiteId, setSelectedRelocationSiteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [districtFilter, setDistrictFilter] = useState("");
  const [tierFilter, setTierFilter] = useState<Tier | "">("");
  const [hazardVisibility, setHazardVisibility] = useState(ALL_HAZARDS_VISIBLE);
  const [hazardOpacity, setHazardOpacity] = useState(0.45);

  const canSeeHabitationData = session?.role === "admin" || session?.role === "state_official";

  // ── View state: 'landing' → 'login' → 'dashboard' ─────────────────
  const [view, setView] = useState<"landing" | "login" | "dashboard">("landing");

  // What-if simulation overlay: when active, override each habitation's tier/score
  // with the simulated values (keeping the baseline suggested sites and geometry).
  const displayedPrioritization = useMemo<PrioritizationItem[]>(() => {
    if (!simResults) return prioritization;
    const baseById = new Map(prioritization.map((p) => [p.habitationId, p]));
    return simResults.map((r) => ({
      ...(baseById.get(r.habitationId) as PrioritizationItem | undefined),
      habitationId: r.habitationId,
      name: r.name,
      state: r.state,
      district: r.district,
      population: r.population,
      tier: r.tier,
      priorityScore: r.priorityScore,
      componentScores: r.componentScores,
      breakdown: r.breakdown,
      weights: r.weights,
      suggestedSites: baseById.get(r.habitationId)?.suggestedSites ?? [],
    }));
  }, [simResults, prioritization]);

  const displayedHabitations = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!simResults || !habitations) return habitations;
    const tierById = new Map(simResults.map((r) => [r.habitationId, r.tier]));
    return {
      ...habitations,
      features: habitations.features.map((f) => {
        const id = String(f.properties?.id);
        const tier = tierById.get(id);
        return tier ? { ...f, properties: { ...f.properties, tier } } : f;
      }),
    };
  }, [simResults, habitations]);

  useEffect(() => {
    if (view === "dashboard" && !session) setView("login");
  }, [session, view]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setSimResults(null); // clear any what-if overlay when the base data reloads

    async function load() {
      try {
        const [hz, sum, siteData] = await Promise.all([getHazardZones(), getSummary(), getSites()]);
        if (cancelled) return;
        setHazardZones(hz);
        setSummary(sum);
        setSites(siteData);

        if (canSeeHabitationData && session) {
          const filters = { district: districtFilter || undefined, tier: tierFilter || undefined };
          const [hab, prio] = await Promise.all([getHabitations(session, filters), getPrioritization(session, filters)]);
          if (cancelled) return;
          setHabitations(hab);
          setPrioritization(prio);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load data");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [session, canSeeHabitationData, districtFilter, tierFilter]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedSiteId(null);
    setSelectedRelocationSiteId(null);
  }, []);

  const handleSelectSite = useCallback((id: string) => {
    setSelectedSiteId(id);
    setSelectedId(null);
    setSelectedRelocationSiteId(null);
  }, []);

  const handleSelectRelocationSite = useCallback((id: string) => {
    setSelectedRelocationSiteId(id);
    setSelectedId(null);
    setSelectedSiteId(null);
  }, []);

  const handleToggleHazard = useCallback((type: HazardType) => {
    setHazardVisibility((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const goToLogin = useCallback(() => setView("login"), []);
  const goToDashboard = useCallback(() => setView("dashboard"), []);

  if (view === "landing") {
    return <LandingPage onSignIn={goToLogin} />;
  }

  if (view === "login") {
    return <LoginScreen onLogin={session => { setSession(session); goToDashboard(); }} />;
  }

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  const selectedSiteFeature = sites?.features.find((f) => String(f.id) === selectedSiteId);
  const selectedRelocationSite = selectedRelocationSiteId ? getRelocationSiteById(selectedRelocationSiteId) : null;
  const selectedHabitation = displayedPrioritization.find((p) => p.habitationId === selectedId);

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar-brand">
          <BrandMark size={26} />
          <h1>Bhoomi Suraksha</h1>
        </div>
        <div className="topbar-right">
          <div className="lang-toggle" role="group" aria-label={t("Language")}>
            <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")} disabled={langLoading}>
              {t("English")}
            </button>
            <button className={lang === "hi" ? "active" : ""} onClick={() => setLang("hi")} disabled={langLoading}>
              {langLoading ? "…" : t("हिन्दी")}
            </button>
          </div>
          <span className="role-badge">{t(session.role.replace("_", " "))}</span>
          {session.stateCode && <span className="state-badge">{session.stateCode}</span>}
          <button className="logout-button" onClick={() => setSession(null)}>
            {t("Sign out")}
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {summary && (
        <div className="stat-row">
          <div className="stat-card stat-card-wide">
            <span className="stat-label">{t("Region")}</span>
            <span className="stat-value stat-value-text">
              {summary.state}
              {summary.districtCount ? ` · ${summary.districtCount} ${t("districts")}` : ""}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t("Habitations")}</span>
            <span className="stat-value">{summary.habitationCount}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t("People exposed")}</span>
            <span className="stat-value">{summary.totalPopulationExposed.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t("Hazard zones")}</span>
            <span className="stat-value">{summary.hazardZoneCount}</span>
          </div>
        </div>
      )}

      {canSeeHabitationData && (
        <Filters
          district={districtFilter}
          onDistrictChange={setDistrictFilter}
          tier={tierFilter}
          onTierChange={setTierFilter}
          hazardVisibility={hazardVisibility}
          onToggleHazard={handleToggleHazard}
          opacity={hazardOpacity}
          onOpacityChange={setHazardOpacity}
        />
      )}

      <div className="dashboard-body">
        <div className="map-column">
          <MapView
            hazardZones={hazardZones}
            habitations={canSeeHabitationData ? displayedHabitations : null}
            sites={sites}
            onSelectHabitation={handleSelect}
            onSelectSite={handleSelectSite}
            onSelectRelocationSite={handleSelectRelocationSite}
            hazardVisibility={hazardVisibility}
            hazardOpacity={hazardOpacity}
          />
          <Legend />
          {selectedSiteFeature && (
            <div className="site-detail-overlay">
              <SiteDetail
                site={selectedSiteFeature.properties as unknown as SiteFeatureProperties}
                onClose={() => setSelectedSiteId(null)}
              />
            </div>
          )}
        </div>
        {canSeeHabitationData && session && (
          <div className="side-column">
            <WhatIfSlider
              session={session}
              onResults={(results) => setSimResults(results)}
              onReset={() => setSimResults(null)}
            />
            <div className="export-bar">
              <button onClick={() => exportPrioritizationCsv(displayedPrioritization)}>{t("Export CSV")}</button>
              <button onClick={() => exportPrioritizationGeoJson(displayedPrioritization, displayedHabitations)}>
                {t("Export GeoJSON")}
              </button>
            </div>
            <PrioritizationPanel items={displayedPrioritization} selectedId={selectedId} onSelect={handleSelect} />
            {(selectedId || selectedRelocationSiteId) && (
              <div className="detail-panel-overlay">
                <DetailPanel
                  type={selectedRelocationSiteId ? "relocation-site" : "habitation"}
                  habitation={selectedHabitation ?? null}
                  relocationSite={selectedRelocationSite ?? null}
                  onClose={() => {
                    setSelectedId(null);
                    setSelectedRelocationSiteId(null);
                  }}
                />
              </div>
            )}
          </div>
        )}
        {!canSeeHabitationData && (
          <div className="side-column">
            <div className="panel">
              <h3>{t("Public view")}</h3>
              <p>
                {t(
                  "Aggregated Red Zone map and district summary only. Habitation-level records and prioritization lists require a State DM Authority or NDRF/MHA login.",
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
