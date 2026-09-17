const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { validPoint } = require('./geo');
const MAX_POINTS = 8000;
const array = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
function readPoint(p) {
  const q = { latitude: Number(p['@_lat']), longitude: Number(p['@_lon']) };
  if (
    p['@_lat'] == null ||
    p['@_lon'] == null ||
    String(p['@_lat']).trim() === '' ||
    String(p['@_lon']).trim() === '' ||
    !validPoint(q)
  )
    throw new Error('GPX 中含无效经纬度');
  if (p.ele !== undefined) {
    q.elevation = Number(p.ele);
    if (!Number.isFinite(q.elevation)) throw new Error('GPX 中含无效海拔');
  }
  return q;
}
function parseGpx(text) {
  if (typeof text !== 'string' || text.length > 3 * 1024 * 1024)
    throw new Error('GPX 文件过大，请控制在 3 MB 内');
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(text)) throw new Error('不支持包含 DTD 或实体声明的 GPX');
  if (XMLValidator.validate(text) !== true) throw new Error('GPX 文件格式不正确');
  const xml = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    processEntities: true,
  }).parse(text);
  if (!xml.gpx) throw new Error('请选择有效的 GPX 文件');
  const g = xml.gpx;
  let segments = array(g.trk)
    .flatMap((t) => array(t.trkseg).map((s) => array(s.trkpt).map(readPoint)))
    .filter((s) => s.length);
  if (!segments.length)
    segments = array(g.rte)
      .map((r) => array(r.rtept).map(readPoint))
      .filter((s) => s.length);
  const count = segments.reduce((n, s) => n + s.length, 0);
  if (count < 2 || !segments.some((s) => s.length >= 2))
    throw new Error('路书至少需要一段包含两个点的轨迹');
  if (count > MAX_POINTS) throw new Error('轨迹超过 8000 个点，请先分段或简化后导入');
  const waypoints = array(g.wpt)
    .slice(0, 100)
    .map((p) => ({
      ...readPoint(p),
      name: typeof p.name === 'string' ? p.name.slice(0, 60) : '途经点',
    }));
  const title =
    (g.metadata && g.metadata.name) ||
    array(g.trk)[0]?.name ||
    array(g.rte)[0]?.name ||
    '导入的路书';
  return {
    title: typeof title === 'string' ? title.slice(0, 60) : '导入的路书',
    segments,
    waypoints,
    source: 'gpx',
  };
}
function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
function exportGpx(route) {
  const segments = route.segments;
  if (!Array.isArray(segments) || !segments.flat().every(validPoint))
    throw new Error('轨迹数据无效');
  const point = (tag, p) =>
    `<${tag} lat="${p.latitude.toFixed(7)}" lon="${p.longitude.toFixed(7)}">${Number.isFinite(p.elevation) ? `<ele>${p.elevation}</ele>` : ''}${p.name ? `<name>${escapeXml(p.name)}</name>` : ''}</${tag}>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Roadbook" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${escapeXml(route.title)}</name></metadata>${(route.waypoints || []).map((p) => point('wpt', p)).join('')}<trk><name>${escapeXml(route.title)}</name>${segments.map((s) => `<trkseg>${s.map((p) => point('trkpt', p)).join('')}</trkseg>`).join('')}</trk></gpx>`;
}
module.exports = { parseGpx, exportGpx, MAX_POINTS };
