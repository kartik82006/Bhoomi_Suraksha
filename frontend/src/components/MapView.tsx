import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { HazardType } from "../types";
import { RELOCATION_SITES, getHabitationSiteLinks } from "../data/relocationSites";

const HAZARD_COLORS: Record<string, string> = {
  landslide: "#a6423a",
  flood: "#2a5f9e",
  coastal_erosion: "#6b4c9a",
  cloudburst: "#2f8f5b",
};

const RELOCATION_SITE_COLORS: Record<string, string> = {
  "Suitable": "#22c55e",
  "Conditional — needs investment": "#f59e0b",
  "Not suitable": "#ef4444",
};

function createRelocationSiteGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: RELOCATION_SITES.map((site) => ({
      type: "Feature",
      id: site.id,
      properties: { id: site.id, name: site.name, status: site.status, suitabilityScore: site.suitabilityScore },
      geometry: { type: "Point", coordinates: [site.longitude, site.latitude] },
    })),
  };
}

function createSiteLinkGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: getHabitationSiteLinks().map((link, idx) => ({
      type: "Feature",
      id: `link-${idx}`,
      properties: { from: link.from, to: link.to },
      geometry: { type: "LineString", coordinates: [link.fromCoords, link.toCoords] },
    })),
  };
}

/** Bounding box of every coordinate in a FeatureCollection, or null if empty. */
function boundsOf(fc: GeoJSON.FeatureCollection): maplibregl.LngLatBoundsLike | null {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
      const [lng, lat] = c as [number, number];
      minLng = Math.min(minLng, lng); minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng); maxLat = Math.max(maxLat, lat);
    } else if (Array.isArray(c)) {
      c.forEach(walk);
    }
  };
  for (const f of fc.features) if (f.geometry && "coordinates" in f.geometry) walk(f.geometry.coordinates);
  if (!Number.isFinite(minLng)) return null;
  return [[minLng, minLat], [maxLng, maxLat]];
}

interface MapViewProps {
  hazardZones: GeoJSON.FeatureCollection | null;
  habitations: GeoJSON.FeatureCollection | null;
  sites: GeoJSON.FeatureCollection | null;
  onSelectHabitation: (id: string) => void;
  onSelectSite?: (id: string) => void;
  onSelectRelocationSite?: (id: string) => void;
  hazardVisibility?: Record<HazardType, boolean>;
  hazardOpacity?: number;
}

export function MapView({
  hazardZones,
  habitations,
  sites,
  onSelectHabitation,
  onSelectSite,
  onSelectRelocationSite,
  hazardVisibility,
  hazardOpacity = 0.45,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [78.46, 30.34],
      zoom: 10.5,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hazardZones) return;

    const fitToData = () => {
      if (fittedRef.current) return;
      const b = boundsOf(hazardZones);
      if (b) {
        map.fitBounds(b, { padding: 50, maxZoom: 12, duration: 0 });
        fittedRef.current = true;
      }
    };

    const apply = () => {
      fitToData();
      if (map.getSource("hazard-zones")) {
        (map.getSource("hazard-zones") as maplibregl.GeoJSONSource).setData(hazardZones);
        return;
      }
      map.addSource("hazard-zones", { type: "geojson", data: hazardZones });
      map.addLayer({
        id: "hazard-zones-fill",
        type: "fill",
        source: "hazard-zones",
        paint: {
          "fill-color": [
            "match",
            ["get", "hazardType"],
            "landslide", HAZARD_COLORS.landslide,
            "flood", HAZARD_COLORS.flood,
            "coastal_erosion", HAZARD_COLORS.coastal_erosion,
            "cloudburst", HAZARD_COLORS.cloudburst,
            "#999999",
          ],
          "fill-opacity": 0.45,
        },
      });
      map.addLayer({
        id: "hazard-zones-outline",
        type: "line",
        source: "hazard-zones",
        paint: { "line-color": "#222", "line-width": 1 },
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [hazardZones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("hazard-zones-fill")) return;

    map.setPaintProperty("hazard-zones-fill", "fill-opacity", hazardOpacity);

    if (hazardVisibility) {
      const visibleTypes = (Object.keys(hazardVisibility) as HazardType[]).filter((t) => hazardVisibility[t]);
      const filter: maplibregl.FilterSpecification = ["in", ["get", "hazardType"], ["literal", visibleTypes]];
      map.setFilter("hazard-zones-fill", filter);
      map.setFilter("hazard-zones-outline", filter);
    }
  }, [hazardVisibility, hazardOpacity, hazardZones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sites) return;
    const apply = () => {
      if (map.getSource("sites")) {
        (map.getSource("sites") as maplibregl.GeoJSONSource).setData(sites);
        return;
      }
      map.addSource("sites", { type: "geojson", data: sites });
      map.addLayer({
        id: "sites-fill",
        type: "fill",
        source: "sites",
        paint: { "fill-color": "#1f7a6c", "fill-opacity": 0.4 },
      });
      map.on("click", "sites-fill", (e: maplibregl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelectSite?.(String(id));
      });
      map.on("mouseenter", "sites-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "sites-fill", () => {
        map.getCanvas().style.cursor = "";
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [sites, onSelectSite]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !habitations) return;

    const apply = () => {
      if (map.getSource("habitations")) {
        (map.getSource("habitations") as maplibregl.GeoJSONSource).setData(habitations);
        return;
      }
      map.addSource("habitations", { type: "geojson", data: habitations });
      map.addLayer({
        id: "habitations-points-halo",
        type: "circle",
        source: "habitations",
        paint: {
          "circle-radius": 13,
          "circle-color": "#000",
          "circle-opacity": 0.12,
          "circle-blur": 0.6,
        },
      });
      map.addLayer({
        id: "habitations-points",
        type: "circle",
        source: "habitations",
        paint: {
          "circle-radius": 8,
          "circle-color": [
            "match",
            ["get", "tier"],
            "immediate", "#b3261e",
            "short_term", "#c26a1d",
            "medium_term", "#a3821a",
            "#718096",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });
      map.on("click", "habitations-points", (e: maplibregl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelectHabitation(String(id));
      });
      map.on("mouseenter", "habitations-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "habitations-points", () => {
        map.getCanvas().style.cursor = "";
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [habitations, onSelectHabitation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const data = createRelocationSiteGeoJSON();
    const apply = () => {
      if (!map.getSource("relocation-sites")) {
        map.addSource("relocation-sites", { type: "geojson", data });
        map.addLayer({
          id: "relocation-sites-points",
          type: "circle",
          source: "relocation-sites",
          paint: {
            "circle-radius": 8,
            "circle-color": ["match", ["get", "status"], "Suitable", RELOCATION_SITE_COLORS.Suitable, "Conditional — needs investment", RELOCATION_SITE_COLORS["Conditional — needs investment"], "Not suitable", RELOCATION_SITE_COLORS["Not suitable"], "#999999"],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
          },
        });
        map.on("click", "relocation-sites-points", (e: maplibregl.MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id;
          if (id) onSelectRelocationSite?.(String(id));
        });
        map.on("mouseenter", "relocation-sites-points", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "relocation-sites-points", () => { map.getCanvas().style.cursor = ""; });
      }
    };
    if (map.isStyleLoaded()) apply(); else map.once("load", apply);
  }, [onSelectRelocationSite]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const data = createSiteLinkGeoJSON();
    const apply = () => {
      if (map.getSource("site-links")) return;
      map.addSource("site-links", { type: "geojson", data });
      map.addLayer({
        id: "site-links-line",
        type: "line",
        source: "site-links",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#4ade80", "line-width": 2, "line-dasharray": [8, 4], "line-opacity": 0.7 },
      });
    };
    if (map.isStyleLoaded()) apply(); else map.once("load", apply);
  }, []);

  return (
    <div className="map-container-shell">
      <div ref={containerRef} className="map-container" />
      {!hazardZones && (
        <div className="map-loading" role="status" aria-live="polite">
          <div className="map-loading-card">
            <span className="loading-kicker">BHOOMI SURAKSHA</span>
            <strong>Loading operational map</strong>
            <span className="loading-line skeleton" />
            <span className="loading-line short skeleton" />
          </div>
        </div>
      )}
    </div>
  );
}
