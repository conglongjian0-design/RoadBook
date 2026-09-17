const core = require('../lib/core');
const fixtures = require('../lib/fixtures');
const config = require('../config');
const KEY = 'roadbook-demo-v1';
function initial() {
  return {
    user: null,
    routes: fixtures
      .map((f, i) => {
        const segments = [
          f.coords.map(([longitude, latitude]) => core.gcjToWgs({ latitude, longitude })),
        ];
        return core.validateRoute({
          title: f.title,
          city: f.city,
          mode: f.mode,
          description: f.description,
          visibility: 'public',
          source: 'demo',
          segments,
          waypoints: [
            { ...segments[0][0], name: f.names[0] },
            { ...segments[0].slice(-1)[0], name: f.names[1] },
          ],
        });
      })
      .map((r, i) => ({
        ...r,
        _id: fixtures[i].id,
        ownerId: 'demo-author',
        authorName: '路书编辑部',
        isDemo: true,
        version: 1,
        createdAt: Date.now() - i * 86400000,
        updatedAt: Date.now() - i * 86400000,
      })),
  };
}
function db() {
  return wx.getStorageSync(KEY) || initial();
}
function save(s) {
  wx.setStorageSync(KEY, s);
}
async function demo(action, data = {}) {
  const s = db();
  const user = s.user;
  if (action === 'session') return user;
  if (action === 'login') {
    s.user = { id: 'demo-user', nickname: '骑行者', avatarUrl: '' };
    save(s);
    return s.user;
  }
  if (action === 'profile') {
    if (!user) throw new Error('请先登录');
    user.nickname = String(data.nickname || '')
      .trim()
      .slice(0, 30);
    if (!user.nickname) throw new Error('请填写昵称');
    user.avatarUrl = data.avatarUrl || '';
    s.routes.forEach((r) => {
      if (r.ownerId === user.id) r.authorName = user.nickname;
    });
    save(s);
    return user;
  }
  if (action === 'list') {
    let list = s.routes.filter((r) =>
      data.mine ? user && r.ownerId === user.id : r.visibility === 'public',
    );
    if (data.mode && data.mode !== 'all') list = list.filter((r) => r.mode === data.mode);
    if (data.keyword) list = list.filter((r) => `${r.title} ${r.city}`.includes(data.keyword));
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    const offset = data.offset || 0;
    return {
      items: list.slice(offset, offset + 20).map(core.summarize),
      hasMore: list.length > offset + 20,
    };
  }
  if (action === 'detail') {
    const r = s.routes.find((r) => r._id === data.id);
    if (!r || (r.visibility !== 'public' && r.ownerId !== user?.id))
      throw new Error('路书不存在或无权访问');
    return { ...r, isOwner: r.ownerId === user?.id };
  }
  if (action === 'save') {
    if (!user) throw new Error('请先登录');
    let old = data.id ? s.routes.find((r) => r._id === data.id) : null;
    if (data.id && (!old || old.ownerId !== user.id)) throw new Error('无权编辑此路书');
    if (old && old.version !== data.version) throw new Error('路书已更新，请重新打开后编辑');
    const r = {
      ...core.validateRoute(data.route),
      _id: old ? old._id : 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      ownerId: user.id,
      authorName: user.nickname,
      isDemo: true,
      version: (old?.version || 0) + 1,
      createdAt: old?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    s.routes = s.routes.filter((x) => x._id !== r._id);
    s.routes.unshift(r);
    save(s);
    return r;
  }
  if (action === 'delete') {
    if (!user) throw new Error('请先登录');
    const r = s.routes.find((r) => r._id === data.id);
    if (!r || r.ownerId !== user.id) throw new Error('无权删除');
    s.routes = s.routes.filter((r) => r._id !== data.id);
    save(s);
    return true;
  }
  if (action === 'plan') {
    if (!user) throw new Error('请先登录');
    if (data.waypoints.length < 2) throw new Error('请添加起点与终点');
    return {
      segments: [data.waypoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))],
      source: 'demo',
      isDemo: true,
    };
  }
  throw new Error('未知操作');
}
async function call(action, data = {}) {
  if (config.mode === 'demo') return demo(action, data);
  const { result } = await wx.cloud.callFunction({
    name: config.cloudFunction,
    data: { action, ...data },
  });
  if (!result || !result.ok) throw new Error(result?.error || '请求失败，请重试');
  return result.data;
}
async function requireLogin() {
  if (await call('session')) return true;
  wx.navigateTo({ url: '/pages/profile/index' });
  return false;
}
function report(error) {
  const message = error.message || error.errMsg || '操作失败';
  if (!/cancel/.test(message)) wx.showToast({ title: message, icon: 'none', duration: 3000 });
}
module.exports = { call, requireLogin, report, isDemo: config.mode === 'demo' };
