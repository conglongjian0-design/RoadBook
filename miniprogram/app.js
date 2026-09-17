const config = require('./config');
App({
  globalData: { config },
  onLaunch() {
    if (config.mode === 'cloud') {
      if (!config.cloudEnv) throw new Error('请先在 config.js 填写云环境 ID');
      wx.cloud.init({ env: config.cloudEnv, traceUser: false });
    }
  },
});
