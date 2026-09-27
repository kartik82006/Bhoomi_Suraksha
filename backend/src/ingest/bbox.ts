export function computeBbox(geometries: GeoJSON.Geometry[]): [number, number, number, number] | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (coords: unknown): void => {
    const arr = coords as unknown[];
    if (typeof arr[0] === "number") {
      const [x, y] = arr as [number, number];
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    } else {
      for (const c of arr) visit(c);
    }
  };

  for (const geom of geometries) {
    if ("coordinates" in geom) visit(geom.coordinates);
  }

  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}
