import { useI18n } from "../i18n";

const HAZARD_ITEMS: [string, string][] = [
  ["Landslide", "#a6423a"],
  ["Flood", "#2a5f9e"],
  ["Coastal erosion", "#6b4c9a"],
  ["Cloudburst", "#2f8f5b"],
];

const TIER_ITEMS: [string, string][] = [
  ["Immediate", "#b3261e"],
  ["Short-term", "#c26a1d"],
  ["Medium-term", "#a3821a"],
];

export function Legend() {
  const { t } = useI18n();
  return (
    <div className="legend">
      <div className="legend-group">
        <h4>{t("Hazard zones")}</h4>
        {HAZARD_ITEMS.map(([label, color]) => (
          <div className="legend-row" key={label}>
            <span className="swatch" style={{ background: color }} />
            {t(label)}
          </div>
        ))}
      </div>
      <div className="legend-group">
        <h4>{t("Priority tier")}</h4>
        {TIER_ITEMS.map(([label, color]) => (
          <div className="legend-row" key={label}>
            <span className="swatch round" style={{ background: color }} />
            {t(label)}
          </div>
        ))}
      </div>
    </div>
  );
}
