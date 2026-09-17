const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const base = path.join(__dirname, '../cloudfunctions/roadbook/node_modules');
test(
  'cloud SDK initializes with supported transaction and missing-document behavior',
  { skip: !fs.existsSync(path.join(base, 'wx-server-sdk')) },
  () => {
    const cloud = require(path.join(base, 'wx-server-sdk'));
    cloud.init({ env: 'local-test-only' });
    const db = cloud.database({ throwOnNotFound: false });
    assert.equal(typeof db.runTransaction, 'function');
    assert.equal(db.config.throwOnNotFound, false);
  },
);
test(
  'compatibility adapters preserve set/unset behavior and block prototype writes',
  { skip: !fs.existsSync(path.join(base, 'lodash.set')) },
  () => {
    const set = require(path.join(base, 'lodash.set')),
      unset = require(path.join(base, 'lodash.unset'));
    const obj = {};
    set(obj, 'a[0].name', 'route');
    assert.equal(obj.a[0].name, 'route');
    unset(obj, 'a[0].name');
    assert.equal(obj.a[0].name, undefined);
    set(obj, '__proto__.roadbookTestPolluted', true);
    assert.equal({}.roadbookTestPolluted, undefined);
  },
);
