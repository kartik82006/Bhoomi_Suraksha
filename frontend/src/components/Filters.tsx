import { useI18n } from "../i18n";
import type { HazardType, Tier } from "../types";

const HAZARD_LABELS: Record<HazardType, string> = {
  landslide: "Landslide",
  flood: "Flood",
  coastal_erosion: "Coastal erosion",
  cloudburst: "Cloudburst",
};

const TIER_OPTIONS: { value: Tier | ""; label: string }[] = [
  { value: "", label: "All tiers" },
  { value: "immediate", label: "Immediate" },
  { value: "short_term", label: "Short-term" },
  { value: "medium_term", label: "Medium-term" },
];

interface FiltersProps {
  district: string;
  onDistrictChange: (value: string) => void;
  tier: Tier | "";
  onTierChange: (value: Tier | "") => void;
  hazardVisibility: Record<HazardType, boolean>;
  onToggleHazard: (type: HazardType) => void;
  opacity: number;
  onOpacityChange: (value: number) => void;
}

export function Filters({
  district,
  onDistrictChange,
  tier,
  onTierChange,
  hazardVisibility,
  onToggleHazard,
  opacity,
  onOpacityChange,
}: FiltersProps) {
  const { t } = useI18n();
  return (
    <div className="filters-bar">
      <label className="filter-field">
        {t("District")}
        <input value={district} onChange={(e) => onDistrictChange(e.target.value)} placeholder={t("Any district")} />
      </label>

      <label className="filter-field">
        {t("Tier")}
        <select value={tier} onChange={(e) => onTierChange(e.target.value as Tier | "")}>
          {TIER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.label)}
            </option>
          ))}
        </select>
      </label>

      <div className="filter-field">
        {t("Hazard layers")}
        <div className="hazard-toggles">
          {(Object.keys(HAZARD_LABELS) as HazardType[]).map((type) => (
            <label key={type} className="hazard-toggle">
              <input type="checkbox" checked={hazardVisibility[type]} onChange={() => onToggleHazard(type)} />
              {t(HAZARD_LABELS[type])}
            </label>
          ))}
        </div>
      </div>

      <label className="filter-field">
        {t("Zone opacity")}
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onOpacityChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
