const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../shared');

function page(name, api, wx = {}) {
  let definition;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../miniprogram/pages', name, 'index.js'), 'utf8'),
    {
      Page: (value) => {
        definition = value;
      },
      require: (id) => (id.endsWith('/core') ? core : api),
      wx,
      setTimeout,
      clearTimeout,
    },
  );
  definition.data = structuredClone(definition.data);
  definition.setData = function (values) {
    Object.assign(this.data, values);
  };
  return definition;
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function route() {
  return core.validateRoute({
    title: '页面验收',
    description: '',
    city: '',
    mode: 'cycling',
    source: 'gpx',
    visibility: 'private',
    segments: [
      [
        { latitude: 31.2, longitude: 121.4 },
        { latitude: 31.3, longitude: 121.5 },
      ],
    ],
    waypoints: [],
  });
}

test('editor ignores old planning response after the user changes travel mode', async () => {
  const request = deferred();
  const editor = page('editor', { call: () => request.promise });
  const pending = editor.plan();
  editor.setMode({ currentTarget: { dataset: { mode: 'walking' } } });
  request.resolve({ segments: route().segments, source: 'planned' });
  await pending;
  assert.equal(editor.data.mode, 'walking');
  assert.equal(editor.data.segments.length, 0);
  assert.equal(editor.data.planning, false);
});

test('non-owner cannot save or leave an unauthorized edit as a draft', async () => {
  let saves = 0;
  const editor = page(
    'editor',
    {
      call: async (action) => {
        if (action === 'save') saves++;
        return { ...route(), isOwner: false };
      },
    },
    {
      setStorageSync: () => {
        throw new Error('unexpected draft');
      },
    },
  );
  await editor.onLoad({ id: 'another-user-route' });
  assert.match(editor.data.error, /无权/);
  editor.data.title = 'should not persist';
  editor.persist();
  await editor.save();
  assert.equal(saves, 0);
});

test('new-route draft is restored, retained on save failure and removed after successful save', async () => {
  const storage = new Map([['roadbook-editor-draft-v1', { ...route(), tab: 'import' }]]);
  let fail = true;
  let destination;
  const editor = page(
    'editor',
    {
      requireLogin: async () => true,
      call: async () => {
        if (fail) throw new Error('网络暂时不可用');
        return { _id: 'saved-route' };
      },
    },
    {
      getStorageSync: (key) => storage.get(key),
      showModal: async () => ({ confirm: true }),
      setStorageSync: (key, value) => storage.set(key, value),
      removeStorageSync: (key) => storage.delete(key),
      redirectTo: (value) => {
        destination = value.url;
      },
    },
  );
  await editor.onLoad({});
  assert.equal(editor.data.pointCount, 2);
  await editor.save();
  editor.onHide();
  assert.equal(storage.size, 1);
  assert.match(editor.data.error, /网络/);
  fail = false;
  await editor.save();
  editor.onUnload();
  assert.equal(storage.size, 0);
  assert.match(destination, /saved-route/);
});

test('latest search response wins when cloud replies arrive out of order', async () => {
  const first = deferred(),
    second = deferred();
  let calls = 0;
  const explore = page('explore', { call: () => (++calls === 1 ? first.promise : second.promise) });
  const a = explore.load(false);
  explore.data.keyword = '新关键词';
  const b = explore.load(false);
  second.resolve({ items: [{ title: 'new' }], hasMore: false });
  await b;
  first.resolve({ items: [{ title: 'old' }], hasMore: true });
  await a;
  assert.equal(explore.data.routes[0].title, 'new');
  assert.equal(explore.data.hasMore, false);
});

test('native detail retains all 8000 map points under 1 MB and hides private sharing', async () => {
  const r = route();
  r.segments = [
    Array.from({ length: 8000 }, (_, i) => ({
      latitude: 31.2 + i * 0.000001,
      longitude: 121.4 + i * 0.000001,
    })),
  ];
  Object.assign(r, core.stats(r.segments));
  const detail = page(
    'detail',
    { isDemo: false, call: async () => r },
    {
      hideShareMenu() {},
      showShareMenu() {
        throw new Error('private sharing');
      },
      env: { USER_DATA_PATH: '/tmp' },
      getFileSystemManager: () => ({ writeFile: ({ success }) => success() }),
    },
  );
  await detail.reload();
  assert.equal(detail.data.polylines[0].points.length, 8000);
  assert.ok(Buffer.byteLength(JSON.stringify(detail.data)) < 1024 * 1024);
  assert.equal(detail.data.route.segments, undefined);
  assert.equal(detail.data.canShare, false);
  assert.equal(detail.onShareAppMessage().path, '/pages/explore/index');
});

test('GPX is prepared before tap so file sharing stays in the user gesture stack', async () => {
  const r = route();
  let apiCalls = 0,
    fileWritten = false,
    shared;
  const detail = page(
    'detail',
    {
      isDemo: false,
      call: async () => {
        apiCalls++;
        return r;
      },
      report: (error) => {
        throw error;
      },
    },
    {
      hideShareMenu() {},
      showShareMenu() {},
      env: { USER_DATA_PATH: '/tmp' },
      getFileSystemManager: () => ({
        writeFile: ({ filePath, data, success }) => {
          assert.match(filePath, /页面验收\.gpx$/);
          assert.match(data, /<gpx/);
          fileWritten = true;
          success();
        },
      }),
      shareFileMessage: (options) => {
        assert.equal(fileWritten, true);
        shared = options;
      },
    },
  );
  await detail.reload();
  assert.equal(detail.data.exportReady, true);
  assert.equal(detail.exportFile(), undefined);
  assert.equal(apiCalls, 1);
  assert.match(shared.filePath, /页面验收\.gpx$/);
});
