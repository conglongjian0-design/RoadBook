const PI = Math.PI;
function validPoint(p) {
  return (
    p &&
    typeof p.latitude === 'number' &&
    typeof p.longitude === 'number' &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}
function outside(p) {
  return (
    p.longitude < 72.004 || p.longitude > 137.8347 || p.latitude < 0.8293 || p.latitude > 55.8271
  );
}
function transform(x, y, lat) {
  let v = lat
    ? -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
    : 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  v += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  const z = lat ? y : x;
  v += ((20 * Math.sin(z * PI) + 40 * Math.sin((z / 3) * PI)) * 2) / 3;
  v +=
    (((lat ? 160 : 150) * Math.sin((z / 12) * PI) + (lat ? 320 : 300) * Math.sin((z * PI) / 30)) *
      2) /
    3;
  return v;
}
function wgsToGcj(p) {
  if (!validPoint(p)) throw new Error('无效的经纬度');
  if (outside(p)) return { ...p };
  const rad = (p.latitude / 180) * PI;
  const magic = 1 - 0.00669342162296594323 * Math.sin(rad) ** 2;
  const root = Math.sqrt(magic);
  return {
    ...p,
    latitude:
      p.latitude +
      (transform(p.longitude - 105, p.latitude - 35, true) * 180) /
        (((6378245 * (1 - 0.00669342162296594323)) / (magic * root)) * PI),
    longitude:
      p.longitude +
      (transform(p.longitude - 105, p.latitude - 35, false) * 180) /
        ((6378245 / root) * Math.cos(rad) * PI),
  };
}
function gcjToWgs(p) {
  if (!validPoint(p)) throw new Error('无效的经纬度');
  if (outside(p)) return { ...p };
  let q = { ...p };
  for (let i = 0; i < 5; i++) {
    const x = wgsToGcj(q);
    q.latitude -= x.latitude - p.latitude;
    q.longitude -= x.longitude - p.longitude;
  }
  return q;
}
function distance(a, b) {
  const r = PI / 180,
    dlat = (b.latitude - a.latitude) * r,
    dlon = (b.longitude - a.longitude) * r;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dlon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
function stats(segments) {
  let meters = 0,
    gain = 0,
    elevation = true,
    count = 0;
  for (const seg of segments)
    for (let i = 0; i < seg.length; i++) {
      count++;
      if (!Number.isFinite(seg[i].elevation)) elevation = false;
      if (i) {
        meters += distance(seg[i - 1], seg[i]);
        if (Number.isFinite(seg[i].elevation) && Number.isFinite(seg[i - 1].elevation))
          gain += Math.max(0, seg[i].elevation - seg[i - 1].elevation);
      }
    }
  return {
    distanceMeters: Math.round(meters),
    elevationGain: elevation && count > 1 ? Math.round(gain) : null,
    pointCount: count,
  };
}
function project(segments, width = 320, height = 170, padding = 24) {
  const all = segments.flat();
  if (!all.length) return [];
  const lat0 = ((all.reduce((s, p) => s + p.latitude, 0) / all.length) * PI) / 180;
  const points = segments.map((s) =>
    s.map((p) => ({ x: p.longitude * Math.cos(lat0), y: -p.latitude })),
  );
  const ps = points.flat(),
    xs = ps.map((p) => p.x),
    ys = ps.map((p) => p.y);
  const minx = Math.min(...xs),
    maxx = Math.max(...xs),
    miny = Math.min(...ys),
    maxy = Math.max(...ys);
  const scale = Math.min(
    (width - padding * 2) / Math.max(maxx - minx, 0.00001),
    (height - padding * 2) / Math.max(maxy - miny, 0.00001),
  );
  return points.map((s) =>
    s.map((p) => ({
      x: (p.x - (minx + maxx) / 2) * scale + width / 2,
      y: (p.y - (miny + maxy) / 2) * scale + height / 2,
    })),
  );
}
module.exports = { validPoint, wgsToGcj, gcjToWgs, distance, stats, project };
