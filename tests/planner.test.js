const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createPlanner } = require('../cloudfunctions/roadbook/planner');
const core = require('../shared');
const stops = [
  { latitude: 31.22, longitude: 121.48 },
  { latitude: 31.23, longitude: 121.49 },
  { latitude: 31.24, longitude: 121.5 },
];
const response = (polyline) => ({ status: '1', route: { paths: [{ steps: [{ polyline }] }] } });
test('planner passes key only to Amap and stores returned geometry as WGS84 in waypoint order', async () => {
  const urls = [];
  const plan = createPlanner({
    getKey: () => 'test-key',
    request: async (raw) => {
      const url = new URL(raw);
      urls.push(url);
      assert.equal(url.origin, 'https://restapi.amap.com');
      assert.equal(url.pathname, '/v5/direction/bicycling');
      return response(url.searchParams.get('origin') + ';' + url.searchParams.get('destination'));
    },
  });
  const r = await plan(stops, 'cycling');
  assert.equal(urls.length, 2);
  assert.equal(r.source, 'planned');
  assert.equal(r.segments[0].length, 3);
  for (let i = 0; i < stops.length; i++) assert.ok(core.distance(r.segments[0][i], stops[i]) < 0.2);
});
test('planner rejects missing key, API errors, missing geometry and disconnected legs', async () => {
  await assert.rejects(createPlanner({ getKey: () => '' })(stops, 'cycling'), /尚未配置/);
  await assert.rejects(
    createPlanner({
      getKey: () => 'key',
      request: async () => ({ status: '0', infocode: '10001' }),
    })(stops, 'cycling'),
    /10001/,
  );
  await assert.rejects(
    createPlanner({
      getKey: () => 'key',
      request: async () => ({ status: '1', route: { paths: [] } }),
    })(stops, 'cycling'),
    /没有可用/,
  );
  let i = 0;
  await assert.rejects(
    createPlanner({
      getKey: () => 'key',
      request: async () => response(i++ ? '122,32;122.01,32.01' : '121,31;121.01,31.01'),
    })(stops, 'cycling'),
    /不连通/,
  );
});
test('planner never replaces provider or network failure with straight lines', async () => {
  const plan = createPlanner({
    getKey: () => 'key',
    request: async () => {
      throw new Error('network unavailable');
    },
  });
  await assert.rejects(plan(stops, 'walking'), /network unavailable/);
});
