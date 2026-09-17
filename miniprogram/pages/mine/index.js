const api = require('../../services/api');
Page({
  data: { user: null, routes: [], loading: false, error: '', hasMore: false, isDemo: api.isDemo },
  onShow() {
    this.refresh();
  },
  async onPullDownRefresh() {
    await this.refresh();
    wx.stopPullDownRefresh();
  },
  async refresh() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await api.call('session');
      this.setData({ user });
      if (!user) {
        this.setData({ routes: [], hasMore: false });
        return;
      }
      const r = await api.call('list', { mine: true });
      this.setData({ routes: r.items, hasMore: r.hasMore });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ loading: false });
    }
  },
  async more() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const r = await api.call('list', { mine: true, offset: this.data.routes.length });
      this.setData({ routes: this.data.routes.concat(r.items), hasMore: r.hasMore });
    } catch (e) {
      api.report(e);
    } finally {
      this.setData({ loading: false });
    }
  },
  profile() {
    wx.navigateTo({ url: '/pages/profile/index' });
  },
  async create() {
    try {
      if (await api.requireLogin()) wx.navigateTo({ url: '/pages/editor/index' });
    } catch (e) {
      api.report(e);
    }
  },
  open(e) {
    wx.navigateTo({
      url: '/pages/detail/index?id=' + encodeURIComponent(e.currentTarget.dataset.id),
    });
  },
});
