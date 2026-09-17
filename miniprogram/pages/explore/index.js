const api = require('../../services/api');
Page({
  data: {
    isDemo: api.isDemo,
    modes: [
      { value: 'all', label: '全部' },
      { value: 'cycling', label: '骑行' },
      { value: 'walking', label: '步行' },
      { value: 'driving', label: '自驾' },
    ],
    mode: 'all',
    keyword: '',
    routes: [],
    loading: false,
    error: '',
    hasMore: false,
  },
  onShow() {
    this.refresh();
  },
  onUnload() {
    clearTimeout(this.timer);
  },
  async refresh() {
    await this.load(false);
  },
  async onPullDownRefresh() {
    await this.refresh();
    wx.stopPullDownRefresh();
  },
  onReachBottom() {
    this.loadMore();
  },
  async load(more) {
    const ticket = (this.ticket || 0) + 1;
    this.ticket = ticket;
    this.setData({ loading: true, error: '' });
    try {
      const r = await api.call('list', {
        mode: this.data.mode,
        keyword: this.data.keyword.trim(),
        offset: more ? this.data.routes.length : 0,
      });
      if (ticket !== this.ticket) return;
      this.setData({
        routes: more ? this.data.routes.concat(r.items) : r.items,
        hasMore: r.hasMore,
      });
    } catch (e) {
      if (ticket === this.ticket) this.setData({ error: e.message });
    } finally {
      if (ticket === this.ticket) this.setData({ loading: false });
    }
  },
  loadMore() {
    if (this.data.hasMore && !this.data.loading) this.load(true);
  },
  filter(e) {
    this.setData({ mode: e.currentTarget.dataset.mode });
    this.refresh();
  },
  search(e) {
    this.setData({ keyword: e.detail.value });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), 300);
  },
  open(e) {
    wx.navigateTo({
      url: '/pages/detail/index?id=' + encodeURIComponent(e.currentTarget.dataset.id),
    });
  },
  async create() {
    try {
      if (await api.requireLogin()) wx.navigateTo({ url: '/pages/editor/index' });
    } catch (e) {
      api.report(e);
    }
  },
});
