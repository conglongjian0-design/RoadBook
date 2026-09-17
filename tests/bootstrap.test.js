const { test } = require('node:test');
const assert = require('node:assert/strict');
const { COLLECTIONS, createBootstrap } = require('../cloudfunctions/roadbook/bootstrap');

test('cloud bootstrap creates only missing collections and is cached per instance', async () => {
  const existing = new Set(['users']);
  const probes = [];
  const created = [];
  const db = {
    collection(name) {
      return {
        limit() {
          return {
            async get() {
              probes.push(name);
              if (!existing.has(name)) {
                const error = new Error('database collection not exists');
                error.code = -502005;
                throw error;
              }
              return { data: [] };
            },
          };
        },
      };
    },
    async createCollection(name) {
      created.push(name);
      existing.add(name);
    },
  };
  const ensure = createBootstrap(db);
  await Promise.all([ensure(), ensure()]);
  await ensure();
  assert.deepEqual(probes.sort(), COLLECTIONS.slice().sort());
  assert.deepEqual(created.sort(), ['rate_limits', 'roadbooks']);
});

test('cloud bootstrap does not hide database permission or network errors', async () => {
  const db = {
    collection() {
      return {
        limit() {
          return { get: async () => Promise.reject(new Error('database permission denied')) };
        },
      };
    },
  };
  await assert.rejects(createBootstrap(db)(), /permission denied/);
});
