import { useI18n } from "../i18n";
import type { PrioritizationItem, Tier } from "../types";
import { type RelocationSite } from "../data/relocationSites";

interface FactorRow {
  label: string;
  value: number;
  maxValue?: number;
  weight?: number;
}

interface DetailPanelProps {
  type: "habitation" | "relocation-site";
  habitation?: PrioritizationItem | null;
  relocationSite?: RelocationSite | null;
  onClose: () => void;
}

const TIER_LABELS: Record<Tier, string> = {
  immediate: "Immediate",
  short_term: "Short-term",
  medium_term: "Medium-term",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  "Suitable": "status-suitable",
  "Conditional — needs investment": "status-conditional",
  "Not suitable": "status-not-suitable",
};

export function DetailPanel({ type, habitation, relocationSite, onClose }: DetailPanelProps) {
  const { t } = useI18n();

  if (type === "habitation" && habitation) {
    const factorRows: FactorRow[] = [
      { label: t("Hazard severity"), value: habitation.breakdown.hazard_severity, maxValue: 100, weight: habitation.weights.alpha },
      { label: t("Population exposure"), value: habitation.breakdown.population_exposure, maxValue: 100, weight: habitation.weights.beta },
      { label: t("Disaster history"), value: habitation.breakdown.disaster_history, maxValue: 100, weight: habitation.weights.gamma },
      { label: t("Vulnerability modifier"), value: habitation.breakdown.vulnerability_modifier, maxValue: 100, weight: habitation.weights.delta },
    ];

    return (
      <div className="panel detail-panel">
        <div className="detail-panel-header">
          <h3>{habitation.name}</h3>
          <button className="close-button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="detail-panel-meta">
          <span className={`tier-badge tier-${habitation.tier}`}>{t(TIER_LABELS[habitation.tier])}</span>
          <span className="score">{t("score")} {habitation.priorityScore}</span>
          <span className="location">{habitation.district}, {habitation.state} · {t("population")} {habitation.population.toLocaleString()}</span>
        </div>
        <div className="factor-breakdown">
          <h4>{t("Score breakdown")}</h4>
          {factorRows.map((row) => (
            <div key={row.label} className="factor-row">
              <div className="factor-row-header">
                <span className="factor-label">{row.label}</span>
                <span className="factor-value">{row.value.toFixed(1)}</span>
                {row.weight !== undefined && row.weight > 0 && (
                  <span className="factor-weight">(weight: {Math.round(row.weight * 100)}%)</span>
                )}
              </div>
              <div className="factor-bar-track">
                <div className="factor-bar-fill" style={{ width: `${Math.min(100, (row.value / (row.maxValue ?? 100)) * 100)}%` }} />
              </div>
            </div>
          ))}
          <div className="weights-summary">
            <h5>{t("Weights used")}</h5>
            <ul>
              {Object.entries(habitation.weights).map(([key, weight]) => (
                <li key={key}>
                  <span>{t(key.replace(/([A-Z])/g, " $1").trim())}</span>
                  <span>{Math.round(weight * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (type === "relocation-site" && relocationSite) {
    const factorRows: FactorRow[] = relocationSite.factors.map((f) => ({
      label: f.label,
      value: f.value,
      maxValue: f.maxValue,
    }));

    return (
      <div className="panel detail-panel">
        <div className="detail-panel-header">
          <h3>{relocationSite.name}</h3>
          <button className="close-button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="detail-panel-meta">
          <span className={`status-badge ${STATUS_BADGE_CLASSES[relocationSite.status] ?? ""}`}>{relocationSite.status}</span>
          <span className="score">{t("suitability score")} {relocationSite.suitabilityScore}</span>
          <span className="location">{t("capacity")} {relocationSite.factors.find((f) => f.key === "capacity")?.value.toLocaleString() ?? "—"} persons</span>
        </div>
        <div className="factor-breakdown">
          <h4>{t("Suitability factors")}</h4>
          {factorRows.map((row) => (
            <div key={row.label} className="factor-row">
              <div className="factor-row-header">
                <span className="factor-label">{row.label}</span>
                <span className="factor-value">{row.maxValue ? `${row.value}/${row.maxValue}` : row.value.toLocaleString()}</span>
              </div>
              {row.maxValue && (
                <div className="factor-bar-track">
                  <div className="factor-bar-fill" style={{ width: `${Math.min(100, (row.value / row.maxValue) * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
