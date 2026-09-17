const https = require('node:https');
const core = require('./core');
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
        if (body.length > 4 * 1024 * 1024) {
          req.destroy();
          reject(new Error('地图响应过大，请缩短路段'));
        }
      });
      res.on('error', () => reject(new Error('地图服务连接中断')));
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) throw new Error();
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('地图服务暂时不可用'));
        }
      });
    });
    req.setTimeout(7000, () => req.destroy(new Error('地图服务超时，请稍后重试')));
    req.on('error', () => reject(new Error('地图服务连接失败，请稍后重试')));
  });
}
function createPlanner({ request = fetchJson, getKey = () => process.env.AMAP_WEB_KEY } = {}) {
  return async function plan(waypoints, mode) {
    const key = getKey();
    if (!key) throw new Error('路线规划尚未配置，请先导入 GPX，或配置高德 Web 服务 Key');
    const endpoints = { cycling: 'bicycling', walking: 'walking', driving: 'driving' },
      points = [];
    const pair = (p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`;
    async function planLeg(i) {
      const params = new URLSearchParams({
        key,
        origin: pair(core.wgsToGcj(waypoints[i - 1])),
        destination: pair(core.wgsToGcj(waypoints[i])),
        show_fields: 'polyline,cost',
      });
      const response = await request(
        `https://restapi.amap.com/v5/direction/${endpoints[mode]}?${params}`,
      );
      if (response.status !== '1')
        throw new Error(
          `第 ${i} 段规划失败，请检查地点或高德服务配置（${response.infocode || '未知错误'}）`,
        );
      const path = response.route?.paths?.[0];
      if (!path?.steps?.length) throw new Error(`第 ${i} 段没有可用路线，请更换途经点`);
      const part = path.steps.flatMap((step) =>
        String(step.polyline || '')
          .split(';')
          .filter(Boolean)
          .map((s) => {
            const [longitude, latitude] = s.split(',').map(Number);
            if (!core.validPoint({ latitude, longitude })) throw new Error('地图返回无效轨迹');
            return core.gcjToWgs({ latitude, longitude });
          }),
      );
      if (part.length < 2) throw new Error(`第 ${i} 段缺少轨迹，请稍后重试`);
      return part;
    }
    // Four concurrent legs keep a 20-stop request inside the cloud function deadline.
    const legs = [];
    for (let i = 1; i < waypoints.length; i += 4) {
      const indices = Array.from({ length: Math.min(4, waypoints.length - i) }, (_, j) => i + j);
      legs.push(...(await Promise.all(indices.map(planLeg))));
    }
    for (const part of legs) {
      if (points.length && core.distance(points[points.length - 1], part[0]) > 15)
        throw new Error('相邻路段不连通，请调整途经点');
      part.forEach((p) => {
        if (!points.length || core.distance(points[points.length - 1], p) > 0.2) points.push(p);
      });
      if (points.length > core.MAX_POINTS) throw new Error('路线过长，请拆分为多本路书');
    }
    return { segments: [points], source: 'planned', isDemo: false };
  };
}
module.exports = { plan: createPlanner(), createPlanner };
