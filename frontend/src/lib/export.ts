import type { PrioritizationItem } from "../types";

function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportPrioritizationCsv(items: PrioritizationItem[]): void {
  const header = ["habitationId", "name", "state", "district", "population", "tier", "priorityScore", "exposureScore", "disasterHistoryScore"];
  const rows = items.map((i) => [
    i.habitationId,
    i.name,
    i.state,
    i.district,
    i.population,
    i.tier,
    i.priorityScore,
    i.componentScores.exposureScore,
    i.componentScores.disasterHistoryScore,
  ]);
  const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadBlob("prioritization.csv", csv, "text/csv");
}

export function exportPrioritizationGeoJson(items: PrioritizationItem[], habitations: GeoJSON.FeatureCollection | null): void {
  const byId = new Map((habitations?.features ?? []).map((f) => [String(f.id), f]));
  const featureCollection = {
    type: "FeatureCollection",
    features: items
      .map((i) => byId.get(i.habitationId))
      .filter((f): f is GeoJSON.Feature => Boolean(f)),
  };
  downloadBlob("prioritization.geojson", JSON.stringify(featureCollection, null, 2), "application/geo+json");
}
