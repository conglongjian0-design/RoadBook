const cloud = require('wx-server-sdk');
const { createService } = require('./service');
const { plan } = require('./planner');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const { createRepository } = require('./repository');
const db = cloud.database({ throwOnNotFound: false });
const repo = createRepository(db);
const { createBootstrap } = require('./bootstrap');
const ensureCollections = createBootstrap(db);
const { createModeration } = require('./moderation');
const moderate = createModeration((params) => cloud.openapi.security.msgSecCheck(params));
const handle = createService({ repo, plan, moderate });
exports.main = async (event) => {
  try {
    await ensureCollections();
    const { OPENID } = cloud.getWXContext();
    return { ok: true, data: await handle(event || {}, OPENID) };
  } catch (error) {
    // Do not expose SDK internals, credentials or user data in client errors.
    const message = String(error.message || '');
    const known =
      /^(请|路|无|昵|头|内|演|标|说|最|轨|相|地|第|起|终|分|出|未|规|云)/.test(message) &&
      message.length < 160;
    return { ok: false, error: known ? message : '服务暂时不可用，请检查云开发配置或稍后重试' };
  }
};
