import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { translateStrings } from "./api";

type Lang = "en" | "hi";

interface I18nValue {
  lang: Lang;
  t: (s: string) => string;
  setLang: (l: Lang) => void;
  loading: boolean;
}

const I18nContext = createContext<I18nValue>({
  lang: "en",
  t: (s) => s,
  setLang: () => {},
  loading: false,
});

// Every user-facing UI string that should be translatable. Translated in one
// batch via the backend Sarvam proxy on first switch to Hindi, then cached.
// Strings not listed here (e.g. proper-noun place names) stay in English.
export const UI_STRINGS: string[] = [
  // topbar / roles
  "Sign out", "admin", "state official", "public viewer",
  "Language", "English", "हिन्दी",
  // stat row
  "Region", "districts", "Habitations", "People exposed", "Hazard zones",
  // filters
  "District", "Any district", "Tier", "All tiers",
  "Immediate", "Short-term", "Medium-term",
  "Hazard layers", "Landslide", "Flood", "Coastal erosion", "Cloudburst",
  "Zone opacity",
  // what-if
  "Rainfall what-if", "Reset", "Normal", "Simulated rainfall",
  "Drag to simulate heavier rainfall and watch priority tiers recompute live.",
  // prioritization panel
  "Relocation priorities", "No prioritization results for this filter.",
  "score", "population", "Exposure", "Disaster history", "Suggested site:",
  "suitability", "capacity",
  // export / public
  "Export CSV", "Export GeoJSON", "Public view",
  "Aggregated Red Zone map and district summary only. Habitation-level records and prioritization lists require a State DM Authority or NDRF/MHA login.",
  // legend
  "Priority tier",
  // login
  "Sign in", "Email", "Password", "Signing in…",
  "AI-GIS Hazard Red-Zone & Relocation Platform",
];

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [dict, setDict] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const setLang = useCallback(
    async (l: Lang) => {
      if (l === "hi" && Object.keys(dict).length === 0) {
        setLoading(true);
        try {
          const translated = await translateStrings(UI_STRINGS, "hi-IN");
          const d: Record<string, string> = {};
          UI_STRINGS.forEach((s, i) => {
            d[s] = translated[i] ?? s;
          });
          setDict(d);
        } finally {
          setLoading(false);
        }
      }
      setLangState(l);
    },
    [dict],
  );

  const t = useCallback((s: string) => (lang === "hi" && dict[s] ? dict[s] : s), [lang, dict]);

  return <I18nContext.Provider value={{ lang, t, setLang, loading }}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  return useContext(I18nContext);
}
