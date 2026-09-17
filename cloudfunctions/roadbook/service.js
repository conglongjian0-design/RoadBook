const core = require('./core');
const crypto = require('node:crypto');
function createService({ repo, plan, moderate }) {
  const safe = (r) => {
    if (!r) return r;
    const { ownerId, ...rest } = r;
    return rest;
  };
  async function user(openid) {
    if (!openid) throw new Error('请在微信中打开小程序');
    return repo.getUser(openid);
  }
  async function requireUser(openid) {
    const u = await user(openid);
    if (!u) throw new Error('请先登录');
    return u;
  }
  async function visible(id, openid) {
    const r = await repo.getRoute(id);
    if (!r || (r.visibility !== 'public' && r.ownerId !== openid))
      throw new Error('路书不存在或无权访问');
    return r;
  }
  return async function handle(event, openid) {
    const action = event.action;
    if (action === 'session') {
      const u = await user(openid);
      return u ? { id: openid, nickname: u.nickname, avatarUrl: u.avatarUrl } : null;
    }
    if (action === 'login') {
      if (!openid) throw new Error('请在微信中登录');
      let u = await repo.getUser(openid);
      if (!u) {
        u = { nickname: '骑行者', avatarUrl: '', createdAt: Date.now() };
        await repo.createUser(openid, u);
        u = await repo.getUser(openid);
      }
      return { id: openid, nickname: u.nickname, avatarUrl: u.avatarUrl };
    }
    if (action === 'profile') {
      await requireUser(openid);
      const nickname = typeof event.nickname === 'string' ? event.nickname.trim() : '';
      if (!nickname || nickname.length > 30) throw new Error('昵称须为 1–30 个字');
      const avatarUrl = event.avatarUrl || '';
      if (
        avatarUrl &&
        (!avatarUrl.startsWith('cloud://') || !avatarUrl.includes(`/avatars/${openid}/`))
      )
        throw new Error('头像文件无效');
      await moderate(nickname, openid, 1);
      await repo.updateUser(openid, { nickname, avatarUrl });
      return { id: openid, nickname, avatarUrl };
    }
    if (action === 'list') {
      if (event.mine) await requireUser(openid);
      const offset = Number(event.offset || 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > 10000)
        throw new Error('分页参数无效');
      const mode = event.mode || 'all';
      if (mode !== 'all' && !core.MODES[mode]) throw new Error('出行方式无效');
      const keyword = String(event.keyword || '')
        .trim()
        .slice(0, 60);
      const rows = await repo.listRoutes({
        ownerId: event.mine ? openid : null,
        mode,
        keyword,
        offset,
        limit: 21,
      });
      return {
        items: rows
          .slice(0, 20)
          .map((r) => ({
            ...safe(r),
            segments: r.previewSegments,
            previewSegments: undefined,
            modeLabel: core.MODES[r.mode],
            distanceLabel: (r.distanceMeters / 1000).toFixed(1),
          })),
        hasMore: rows.length > 20,
      };
    }
    if (action === 'detail') {
      const r = await visible(event.id, openid);
      const author = await repo.getUser(r.ownerId);
      return {
        ...safe(r),
        authorName: author?.nickname || r.authorName,
        isOwner: r.ownerId === openid,
      };
    }
    if (action === 'save') {
      const u = await requireUser(openid);
      const clean = core.validateRoute(event.route);
      if (clean.source === 'demo') throw new Error('演示路线不能上传到正式路书库');
      if (event.id) {
        const old = await visible(event.id, openid);
        if (old.ownerId !== openid) throw new Error('无权编辑此路书');
      }
      await moderate(
        [clean.title, clean.description, clean.city, ...clean.waypoints.map((p) => p.name)].join(
          '\n',
        ),
        openid,
      );
      const id = event.id || crypto.randomUUID();
      const now = Date.now();
      const data = {
        ...clean,
        previewSegments: core.summarize(clean).segments,
        ownerId: openid,
        authorName: u.nickname,
        isDemo: false,
        updatedAt: now,
      };
      const saved = await repo.saveRoute(id, data, {
        ownerId: openid,
        version: event.id ? event.version : null,
        create: !event.id,
      });
      return { ...safe(saved), isOwner: true };
    }
    if (action === 'delete') {
      await requireUser(openid);
      await repo.deleteRoute(event.id, openid);
      return true;
    }
    if (action === 'plan') {
      await requireUser(openid);
      const ps = event.waypoints;
      if (
        !core.MODES[event.mode] ||
        !Array.isArray(ps) ||
        ps.length < 2 ||
        ps.length > 20 ||
        !ps.every(core.validPoint)
      )
        throw new Error('请设置 2–20 个有效地点');
      const cleaned = ps.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
      for (let i = 1; i < cleaned.length; i++)
        if (core.distance(cleaned[i - 1], cleaned[i]) < 5)
          throw new Error('相邻地点太近，请调整后规划');
      await repo.rateLimit(openid);
      return plan(cleaned, event.mode);
    }
    throw new Error('未知操作');
  };
}
module.exports = { createService };
