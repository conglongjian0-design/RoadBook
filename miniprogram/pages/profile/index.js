const api = require('../../services/api');
Page({
  data: { user: null, nickname: '', avatarUrl: '', busy: false, error: '', isDemo: api.isDemo },
  async onLoad() {
    try {
      const user = await api.call('session');
      if (user) this.setData({ user, nickname: user.nickname, avatarUrl: user.avatarUrl });
    } catch (e) {
      this.setData({ error: e.message });
    }
  },
  async login() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const user = await api.call('login');
      this.setData({ user, nickname: user.nickname, avatarUrl: user.avatarUrl });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  avatar(e) {
    this.pendingAvatar = e.detail.avatarUrl;
    this.setData({ avatarUrl: e.detail.avatarUrl });
  },
  async save(e) {
    if (this.data.busy) return;
    const nickname = String(e.detail.value.nickname || '').trim();
    if (!nickname) {
      this.setData({ error: '请填写昵称' });
      return;
    }
    this.setData({ busy: true, error: '' });
    try {
      let avatarUrl = this.data.avatarUrl;
      if (this.pendingAvatar) {
        if (api.isDemo) {
          const r = await wx.saveFile({ tempFilePath: this.pendingAvatar });
          avatarUrl = r.savedFilePath;
        } else {
          const r = await wx.cloud.uploadFile({
            cloudPath: `avatars/${this.data.user.id}/${Date.now()}.jpg`,
            filePath: this.pendingAvatar,
          });
          avatarUrl = r.fileID;
        }
      }
      await api.call('profile', { nickname, avatarUrl });
      wx.showToast({ title: '资料已保存' });
      wx.navigateBack();
    } catch (err) {
      this.setData({ error: err.message || '保存失败，请重试' });
    } finally {
      this.setData({ busy: false });
    }
  },
});
