const api = require('../../services/api');
Page({
  data: {
    user: null,
    routes: [],
    loading: false,
    error: '',
    hasMore: false,
    isDemo: api.isDemo,
    stats: { routes: 0, public: 0, distance: '0' },
  },
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
        this.setRoutes([], false);
        return;
      }
      const r = await api.call('list', { mine: true });
      this.setRoutes(r.items, r.hasMore);
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ loading: false });
    }
  },
  setRoutes(routes, hasMore) {
    const total = routes.reduce((sum, item) => sum + (Number(item.distanceLabel) || 0), 0);
    this.setData({
      routes,
      hasMore,
      stats: {
        routes: routes.length,
        public: routes.filter((item) => item.visibility === 'public').length,
        distance: total >= 100 ? String(Math.round(total)) : total.toFixed(1),
      },
    });
  },
  async more() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const r = await api.call('list', { mine: true, offset: this.data.routes.length });
      this.setRoutes(this.data.routes.concat(r.items), r.hasMore);
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
