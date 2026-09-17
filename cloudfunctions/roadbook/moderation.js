// Bound each check and overlap chunk edges so a phrase at a boundary is checked together.
function textChunks(content, size = 2000, overlap = 100) {
  const chars = Array.from(content),
    chunks = [];
  for (let i = 0; i < chars.length; i += size - overlap) {
    chunks.push(chars.slice(i, i + size).join(''));
    if (i + size >= chars.length) break;
  }
  return chunks;
}
function createModeration(check) {
  return async function moderate(content, openid, scene = 3) {
    for (const chunk of textChunks(content)) {
      const result = await check({ openid, scene, version: 2, content: chunk });
      if (result?.result?.suggest !== 'pass')
        throw new Error('内容暂未通过检查，请调整名称或说明后重试');
    }
  };
}
module.exports = { createModeration, textChunks };
