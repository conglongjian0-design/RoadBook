const geo = require('./geo');
const { MAX_POINTS } = require('./gpx');
const MODES = { cycling: '骑行', walking: '步行', driving: '自驾' };
function cleanPoint(p) {
  if (!geo.validPoint(p)) throw new Error('无效的路线坐标');
  const q = { latitude: p.latitude, longitude: p.longitude };
  if (Number.isFinite(p.elevation)) q.elevation = p.elevation;
  return q;
}
function validateRoute(input) {
  if (!input || typeof input !== 'object') throw new Error('路书内容不能为空');
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title || title.length > 60) throw new Error('标题须为 1–60 个字');
  if (!MODES[input.mode]) throw new Error('请选择出行方式');
  if (!['public', 'private'].includes(input.visibility)) throw new Error('请选择可见范围');
  if (typeof input.description !== 'string' || input.description.length > 2000)
    throw new Error('说明不能超过 2000 字');
  if (!Array.isArray(input.segments) || input.segments.length > 100 || !input.segments.length)
    throw new Error('请先导入或规划路线');
  const count = input.segments.reduce(
    (n, s) => n + (Array.isArray(s) ? s.length : MAX_POINTS + 1),
    0,
  );
  if (count > MAX_POINTS) throw new Error('轨迹最多支持 8000 个点');
  if (!input.segments.some((s) => s.length >= 2) || input.segments.some((s) => !s.length))
    throw new Error('路线至少需要两个连续轨迹点');
  const segments = input.segments.map((s) => s.map(cleanPoint));
  if (!Array.isArray(input.waypoints) || input.waypoints.length > 100)
    throw new Error('最多支持 100 个标记点');
  const waypoints = input.waypoints.map((p) => ({
    ...cleanPoint(p),
    name: String(p.name || '途经点').slice(0, 60),
  }));
  return {
    title,
    mode: input.mode,
    visibility: input.visibility,
    description: input.description.trim(),
    city: String(input.city || '')
      .trim()
      .slice(0, 30),
    segments,
    waypoints,
    source: input.source === 'gpx' ? 'gpx' : input.source === 'planned' ? 'planned' : 'demo',
    ...geo.stats(segments),
    coordinateSystem: 'WGS84',
  };
}
function endpoints(route) {
  const all = route.segments.flat();
  return { start: all[0], end: all[all.length - 1] };
}
function routeStops(route) {
  const { start, end } = endpoints(route),
    wp = route.waypoints || [];
  const threshold = route.source === 'gpx' ? 30 : 250;
  const startIndex = wp.findIndex((p) => geo.distance(p, start) < threshold);
  let endIndex = -1;
  for (let i = wp.length - 1; i >= 0; i--)
    if (geo.distance(wp[i], end) < threshold) {
      endIndex = i;
      break;
    }
  return [
    { ...start, name: startIndex >= 0 ? wp[startIndex].name : '路书起点', role: '起点' },
    ...wp
      .filter((_, i) => i !== startIndex && i !== endIndex)
      .map((p) => ({ ...p, role: route.source === 'gpx' ? '标记点' : '途经点' })),
    { ...end, name: endIndex >= 0 ? wp[endIndex].name : '路书终点', role: '终点' },
  ];
}
function amapUrl(route, options = {}) {
  const { start, end } = endpoints(route),
    a = geo.wgsToGcj(start),
    b = geo.wgsToGcj(end);
  const stops = routeStops(route),
    wp = route.waypoints || [];
  const pair = (p, name) =>
    `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)},${name.replace(/[,|]/g, ' ')}`;
  const params = {
    from: options.currentLocation ? '' : pair(a, stops[0].name),
    to: pair(b, stops[stops.length - 1].name),
    mode: { cycling: 'ride', walking: 'walk', driving: 'car' }[route.mode] || 'ride',
    src: 'roadbook',
    callnative: '1',
  };
  // Imported GPX wpt entries are unordered POIs, not navigation constraints.
  if (route.mode === 'driving' && route.source !== 'gpx' && wp.length === 3)
    params.via = pair(geo.wgsToGcj(wp[1]), wp[1].name);
  return (
    'https://uri.amap.com/navigation?' +
    Object.keys(params)
      .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
      .join('&')
  );
}
function summarize(route) {
  const { segments, ...rest } = route;
  // Preserve segment boundaries in previews, and keep the original endpoints.
  const total = segments.reduce((n, s) => n + s.length, 0);
  const previewSegments = segments.map((s) => {
    const budget = Math.max(2, Math.floor((200 * s.length) / total));
    const step = Math.max(1, Math.ceil(s.length / budget));
    const ps = s.filter((_, i) => i % step === 0);
    if (ps[ps.length - 1] !== s[s.length - 1]) ps.push(s[s.length - 1]);
    return ps;
  });
  return {
    ...rest,
    segments: previewSegments,
    distanceLabel: (route.distanceMeters / 1000).toFixed(1),
    modeLabel: MODES[route.mode],
  };
}
module.exports = { MODES, validateRoute, endpoints, routeStops, amapUrl, summarize };
