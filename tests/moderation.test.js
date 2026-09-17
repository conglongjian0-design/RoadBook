const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createModeration, textChunks } = require('../cloudfunctions/roadbook/moderation');
test('long user text is checked in overlapping Unicode-safe chunks', async () => {
  const text = '路'.repeat(1998) + '🚲骑行' + '程'.repeat(2500),
    chunks = textChunks(text);
  assert.ok(chunks.every((s) => Array.from(s).length <= 2000));
  assert.ok(chunks.some((s) => s.includes('🚲骑行')));
  const requests = [];
  await createModeration(async (p) => {
    requests.push(p);
    return { result: { suggest: 'pass' } };
  })(text, 'user', 3);
  assert.equal(requests.length, chunks.length);
  assert.equal(requests[0].openid, 'user');
  assert.equal(requests[0].version, 2);
});
test('review, risky, incomplete response or service failure rejects publication', async () => {
  for (const r of [{ result: { suggest: 'review' } }, { result: { suggest: 'risky' } }, {}])
    await assert.rejects(createModeration(async () => r)('路线', 'u'), /未通过/);
  await assert.rejects(
    createModeration(async () => {
      throw new Error('offline');
    })('路线', 'u'),
    /offline/,
  );
});
