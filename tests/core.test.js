const { test } = require('node:test'),
  assert = require('node:assert/strict');
const core = require('../shared');
const p = (latitude, longitude, elevation) =>
  elevation === undefined ? { latitude, longitude } : { latitude, longitude, elevation };
const sample = () => ({
  title: '江边 & 日落 <路线>',
  description: '河畔骑行',
  city: '上海',
  mode: 'cycling',
  visibility: 'private',
  source: 'gpx',
  segments: [
    [p(31.22, 121.48, 4), p(31.23, 121.49, 8)],
    [p(32.1, 120.1, 3), p(32.11, 120.12, 5)],
  ],
  waypoints: [{ ...p(31.22, 121.48), name: '起点 & 桥' }],
});
test('GPX round trip preserves all points, disconnected segments, elevation and escaped names', () => {
  const r = sample(),
    out = core.parseGpx(core.exportGpx(r));
  assert.deepEqual(out.segments, r.segments);
  assert.equal(out.title, r.title);
  assert.equal(out.waypoints[0].name, r.waypoints[0].name);
});
test('namespaced GPX route fallback and track priority', () => {
  const x =
    '<g:gpx xmlns:g="http://www.topografix.com/GPX/1/1"><g:rte><g:name>旅行</g:name><g:rtept lat="0" lon="0"/><g:rtept lat="1" lon="1"/></g:rte></g:gpx>';
  assert.equal(core.parseGpx(x).segments[0].length, 2);
  assert.equal(core.parseGpx(x).title, '旅行');
});
test('malformed XML, missing coordinates, out of range, DTD and insufficient points rejected', () => {
  for (const xml of [
    '<gpx>',
    '<gpx><trk><trkseg><trkpt lat="31"/><trkpt lat="32" lon="121"/></trkseg></trk></gpx>',
    '<gpx><rte><rtept lat="91" lon="1"/><rtept lat="1" lon="1"/></rte></gpx>',
    '<!DOCTYPE gpx [<!ENTITY a SYSTEM "file:///etc/passwd">]><gpx/>',
    '<gpx><wpt lat="31" lon="121"/></gpx>',
  ])
    assert.throws(() => core.parseGpx(xml));
});
test('GPX and route point budget enforced before persistence', () => {
  const xml =
    '<gpx><trk><trkseg>' +
    Array(8001).fill('<trkpt lat="1" lon="1"/>').join('') +
    '</trkseg></trk></gpx>';
  assert.throws(() => core.parseGpx(xml), /8000/);
  assert.throws(() => core.parseGpx(' '.repeat(3 * 1024 * 1024 + 1)), /过大/);
});
test('distance does not connect disconnected track segments and missing elevation stays unknown', () => {
  const r = sample(),
    expected = core.distance(...r.segments[0]) + core.distance(...r.segments[1]);
  const stats = core.stats(r.segments);
  assert.equal(stats.distanceMeters, Math.round(expected));
  assert.equal(stats.elevationGain, 6);
  assert.equal(core.stats([[p(1, 1), p(2, 2)]]).elevationGain, null);
});
test('WGS84 / GCJ02 round trip within 0.1 m, overseas is unchanged', () => {
  const point = p(31.22, 121.48),
    gcj = core.wgsToGcj(point);
  assert.ok(core.distance(point, gcj) > 100);
  assert.ok(core.distance(point, core.gcjToWgs(gcj)) < 0.1);
  assert.deepEqual(core.wgsToGcj(p(51, -0.1)), p(51, -0.1));
});
test('Amap URL encodes origin, destination, cycling mode and callnative without false via support', () => {
  const r = sample();
  r.waypoints = [
    { ...r.segments[0][0], name: 'A&B,桥' },
    { ...r.segments[0][1], name: 'B' },
    { ...r.segments[1][1], name: '终点' },
  ];
  const u = new URL(core.amapUrl(r));
  assert.equal(u.origin, 'https://uri.amap.com');
  assert.equal(u.searchParams.get('mode'), 'ride');
  assert.equal(u.searchParams.get('callnative'), '1');
  assert.equal(u.searchParams.has('via'), false);
  assert.match(u.searchParams.get('from'), /A&B 桥/);
  assert.match(u.searchParams.get('to'), /终点/);
  r.mode = 'driving';
  r.source = 'planned';
  assert.ok(new URL(core.amapUrl(r)).searchParams.has('via'));
});
test('validation rejects invalid visibility/mode, strips ownership injection and trims title', () => {
  const r = { ...sample(), title: ' 骑行 ', ownerId: 'attacker', isDemo: false };
  const c = core.validateRoute(r);
  assert.equal(c.title, '骑行');
  assert.equal(c.ownerId, undefined);
  assert.equal(c.isDemo, undefined);
  assert.throws(() => core.validateRoute({ ...r, visibility: 'unlisted' }));
  assert.throws(() => core.validateRoute({ ...r, mode: 'flying' }));
  assert.throws(() => core.validateRoute({ ...r, segments: [[p(31, NaN), p(32, 121)]] }));
});
test('summaries retain first/last point and segment boundaries', () => {
  const r = core.validateRoute(sample()),
    s = core.summarize(r);
  assert.equal(s.segments.length, 2);
  assert.deepEqual(core.endpoints(s), core.endpoints(r));
});
test('unordered GPX POIs never replace endpoint labels or become driving via constraints', () => {
  const r = sample();
  r.mode = 'driving';
  r.waypoints = [
    { latitude: 30, longitude: 120, name: '补给点' },
    { latitude: 30.1, longitude: 120.1, name: '景点' },
    { latitude: 30.2, longitude: 120.2, name: '洗手间' },
  ];
  const stops = core.routeStops(r);
  assert.equal(stops[0].name, '路书起点');
  assert.equal(stops.at(-1).name, '路书终点');
  assert.equal(stops[1].role, '标记点');
  const u = new URL(core.amapUrl(r));
  assert.match(u.searchParams.get('from'), /路书起点/);
  assert.match(u.searchParams.get('to'), /路书终点/);
  assert.equal(u.searchParams.has('via'), false);
});
module.exports = { sample };
