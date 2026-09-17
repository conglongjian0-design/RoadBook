const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createService } = require('../cloudfunctions/roadbook/service');
function route() {
  return {
    title: '测试路书',
    description: '',
    city: '上海',
    mode: 'cycling',
    visibility: 'private',
    source: 'gpx',
    segments: [
      [
        { latitude: 31, longitude: 121 },
        { latitude: 31.01, longitude: 121.01 },
      ],
    ],
    waypoints: [],
  };
}
function setup() {
  const users = new Map(),
    routes = new Map();
  let calls = 0,
    checks = 0;
  const repo = {
    async getUser(id) {
      return users.get(id) || null;
    },
    async createUser(id, u) {
      users.set(id, u);
    },
    async updateUser(id, u) {
      users.set(id, { ...users.get(id), ...u });
    },
    async getRoute(id) {
      return routes.get(id) || null;
    },
    async listRoutes({ ownerId, mode, keyword, offset, limit }) {
      return [...routes.values()]
        .filter((r) => (ownerId ? r.ownerId === ownerId : r.visibility === 'public'))
        .filter((r) => mode === 'all' || r.mode === mode)
        .filter((r) => !keyword || (r.title + r.city).includes(keyword))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(offset, offset + limit);
    },
    async saveRoute(id, r, opts) {
      const old = routes.get(id);
      if (!opts.create && (!old || old.ownerId !== opts.ownerId)) throw new Error('无权编辑');
      if (old && old.version !== opts.version) throw new Error('路书已更新');
      const out = { ...r, _id: id, version: (old?.version || 0) + 1 };
      routes.set(id, out);
      return out;
    },
    async deleteRoute(id, owner) {
      if (routes.get(id)?.ownerId !== owner) throw new Error('无权删除');
      routes.delete(id);
    },
    async rateLimit() {
      calls++;
    },
  };
  const handle = createService({
    repo,
    plan: async () => ({ segments: [], source: 'planned' }),
    moderate: async (text) => {
      checks++;
      if (text.includes('BLOCK')) throw new Error('内容未通过检查');
    },
  });
  return { handle, users, routes, counters: () => ({ calls, checks }) };
}
test('cloud identity required for mutations, public browsing allowed', async () => {
  const { handle } = setup();
  assert.equal(await handle({ action: 'session' }, 'alice'), null);
  await assert.rejects(handle({ action: 'save', route: route() }, 'alice'), /登录/);
  assert.deepEqual(await handle({ action: 'list' }, undefined), { items: [], hasMore: false });
});
test('private route access and export source restricted to owner; public toggle immediately enforced', async () => {
  const { handle } = setup();
  await handle({ action: 'login' }, 'alice');
  const r = await handle({ action: 'save', route: route(), ownerId: 'bob' }, 'alice');
  assert.equal(r.ownerId, undefined);
  await assert.rejects(handle({ action: 'detail', id: r._id }, 'bob'), /无权/);
  assert.equal((await handle({ action: 'detail', id: r._id }, 'alice')).isOwner, true);
  assert.equal((await handle({ action: 'list' }, 'bob')).items.length, 0);
  const published = await handle(
    { action: 'save', id: r._id, version: r.version, route: { ...route(), visibility: 'public' } },
    'alice',
  );
  assert.equal((await handle({ action: 'detail', id: r._id }, 'bob')).isOwner, false);
  assert.equal((await handle({ action: 'list' }, 'bob')).items.length, 1);
  await handle({ action: 'save', id: r._id, version: published.version, route: route() }, 'alice');
  await assert.rejects(handle({ action: 'detail', id: r._id }, 'bob'), /无权/);
});
test('cannot edit or delete another author public route, cannot forge author', async () => {
  const { handle } = setup();
  await handle({ action: 'login' }, 'alice');
  await handle({ action: 'login' }, 'bob');
  const r = await handle(
    {
      action: 'save',
      route: { ...route(), visibility: 'public', ownerId: 'bob', authorName: 'forged' },
    },
    'alice',
  );
  assert.equal(r.authorName, '骑行者');
  await assert.rejects(
    handle({ action: 'save', id: r._id, version: 1, route: route() }, 'bob'),
    /无权/,
  );
  await assert.rejects(handle({ action: 'delete', id: r._id }, 'bob'), /无权/);
});
test('revision conflict prevents silent overwrite and double deletion is rejected', async () => {
  const { handle } = setup();
  await handle({ action: 'login' }, 'a');
  const r = await handle({ action: 'save', route: route() }, 'a');
  await handle(
    { action: 'save', id: r._id, version: 1, route: { ...route(), title: '新版' } },
    'a',
  );
  await assert.rejects(
    handle({ action: 'save', id: r._id, version: 1, route: route() }, 'a'),
    /更新/,
  );
  await handle({ action: 'delete', id: r._id }, 'a');
  await assert.rejects(handle({ action: 'delete', id: r._id }, 'a'));
});
test('moderation fails closed, demo data cannot enter production', async () => {
  const { handle, routes } = setup();
  await handle({ action: 'login' }, 'a');
  await assert.rejects(
    handle({ action: 'save', route: { ...route(), title: 'BLOCK' } }, 'a'),
    /内容/,
  );
  assert.equal(routes.size, 0);
  await assert.rejects(
    handle({ action: 'save', route: { ...route(), source: 'demo' } }, 'a'),
    /演示/,
  );
});
test('planning enforces auth, count and coordinate validity before API calls', async () => {
  const { handle, counters } = setup();
  await handle({ action: 'login' }, 'a');
  await assert.rejects(handle({ action: 'plan', mode: 'cycling', waypoints: [] }, 'a'));
  await assert.rejects(
    handle(
      {
        action: 'plan',
        mode: 'cycling',
        waypoints: [
          { latitude: 31, longitude: 121 },
          { latitude: 31, longitude: 121 },
        ],
      },
      'a',
    ),
    /太近/,
  );
  assert.equal(counters().calls, 0);
  await handle({ action: 'plan', mode: 'cycling', waypoints: route().segments[0] }, 'a');
  assert.equal(counters().calls, 1);
});
test('profile validates nickname and restricts avatar files to current identity', async () => {
  const { handle } = setup();
  await handle({ action: 'login' }, 'a');
  await assert.rejects(handle({ action: 'profile', nickname: '', avatarUrl: '' }, 'a'));
  await assert.rejects(
    handle({ action: 'profile', nickname: '骑友', avatarUrl: 'cloud://env/avatars/b/1.jpg' }, 'a'),
  );
  const u = await handle(
    { action: 'profile', nickname: '骑友', avatarUrl: 'cloud://env/avatars/a/1.jpg' },
    'a',
  );
  assert.equal(u.nickname, '骑友');
});
test('listing paginates and does not expose private records or OPENID', async () => {
  const { handle } = setup();
  await handle({ action: 'login' }, 'a');
  for (let i = 0; i < 22; i++)
    await handle(
      { action: 'save', route: { ...route(), title: '路线' + i, visibility: 'public' } },
      'a',
    );
  const first = await handle({ action: 'list' }, 'b'),
    second = await handle({ action: 'list', offset: 20 }, 'b');
  assert.equal(first.items.length, 20);
  assert.equal(first.hasMore, true);
  assert.equal(second.items.length, 2);
  assert.equal(first.items[0].ownerId, undefined);
  await assert.rejects(handle({ action: 'list', offset: -1 }, 'b'));
});
