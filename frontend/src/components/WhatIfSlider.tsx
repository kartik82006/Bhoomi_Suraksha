import { useRef, useState } from "react";
import { simulatePrioritization, type SimulationResult } from "../api";
import { useI18n } from "../i18n";
import type { Session } from "../types";

interface WhatIfSliderProps {
  session: Session;
  onResults: (results: SimulationResult["results"], rainfall: number) => void;
  onReset: () => void;
}

export function WhatIfSlider({ session, onResults, onReset }: WhatIfSliderProps) {
  const { t } = useI18n();
  const [rainfall, setRainfall] = useState(1);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const runSim = async (value: number) => {
    setRainfall(value);
    if (value === 1) {
      onReset();
      return;
    }
    const mySeq = ++seq.current;
    setBusy(true);
    try {
      const sim = await simulatePrioritization(session, value);
      if (mySeq === seq.current) onResults(sim.results, value);
    } finally {
      if (mySeq === seq.current) setBusy(false);
    }
  };

  return (
    <div className="whatif">
      <div className="whatif-header">
        <h3>{t("Rainfall what-if")}</h3>
        <button
          className="whatif-reset"
          onClick={() => runSim(1)}
          disabled={rainfall === 1}
        >
          {t("Reset")}
        </button>
      </div>
      <p className="whatif-desc">
        {t("Drag to simulate heavier rainfall and watch priority tiers recompute live.")}
      </p>
      <div className="whatif-control">
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={rainfall}
          onChange={(e) => runSim(Number(e.target.value))}
        />
        <span className={`whatif-value ${rainfall > 1 ? "raised" : ""}`}>
          {rainfall === 1 ? t("Normal") : `${rainfall.toFixed(1)}×`}
          {busy ? " …" : ""}
        </span>
      </div>
    </div>
  );
}
