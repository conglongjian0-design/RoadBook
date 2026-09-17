const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createRepository } = require('../cloudfunctions/roadbook/repository');
function setup() {
  const store = new Map();
  const db = {
    command: {},
    runTransaction: async (cb) =>
      cb({
        collection: (name) => ({
          doc: (id) => ({
            get: async () => ({ data: store.get(name + '/' + id) || null }),
            set: async ({ data }) => {
              store.set(name + '/' + id, { ...data });
            },
            remove: async () => store.delete(name + '/' + id),
          }),
        }),
      }),
  };
  return { repo: createRepository(db), store };
}
test('repository uses supported doc-only transaction API for create/update/delete', async () => {
  const { repo, store } = setup();
  await repo.createUser('a', { nickname: 'A' });
  await repo.createUser('a', { nickname: 'B' });
  assert.equal(store.get('users/a').nickname, 'A');
  const r = await repo.saveRoute(
    'one',
    { title: '路线', ownerId: 'a' },
    { ownerId: 'a', create: true },
  );
  assert.equal(r.version, 1);
  const next = await repo.saveRoute(
    'one',
    { title: '新版', ownerId: 'a' },
    { ownerId: 'a', create: false, version: 1 },
  );
  assert.equal(next.version, 2);
  await assert.rejects(
    repo.saveRoute('one', { ownerId: 'a' }, { ownerId: 'a', create: false, version: 1 }),
    /更新/,
  );
  await assert.rejects(repo.deleteRoute('one', 'b'), /无权/);
  await repo.deleteRoute('one', 'a');
  assert.equal(store.has('roadbooks/one'), false);
});
test('rate limiter transaction creates missing counter and rejects sixth request', async () => {
  const { repo, store } = setup();
  for (let i = 0; i < 5; i++) await repo.rateLimit('a');
  await assert.rejects(repo.rateLimit('a'), /频繁/);
  store.get('rate_limits/a').start = Date.now() - 61000;
  await repo.rateLimit('a');
  assert.equal(store.get('rate_limits/a').count, 1);
});
