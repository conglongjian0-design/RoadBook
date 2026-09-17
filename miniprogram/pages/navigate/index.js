const api = require('../../services/api'),
  core = require('../../lib/core');
Page({
  data: { route: null, error: '', destinations: [], selected: 0, isLoop: false },
  onLoad(q) {
    this.id = q.id;
    this.reload();
  },
  async reload() {
    try {
      const route = await api.call('detail', { id: this.id });
      const { start, end } = core.endpoints(route),
        stops = core.routeStops(route),
        startName = stops[0].name,
        endName = stops[stops.length - 1].name;
      const destinations = [
        { ...end, name: endName + '（终点）' },
        { ...start, name: startName + '（起点）' },
        ...stops.slice(1, -1),
      ];
      this.setData({
        route,
        destinations,
        startName,
        endName,
        modeLabel: core.MODES[route.mode],
        isLoop: core.distance(start, end) < 30,
        error: '',
      });
    } catch (e) {
      this.setData({ error: e.message, route: null });
    }
  },
  select(e) {
    this.setData({ selected: Number(e.detail.value) });
  },
  async openLocation() {
    try {
      const p = core.wgsToGcj(this.data.destinations[this.data.selected]);
      await wx.openLocation({
        latitude: p.latitude,
        longitude: p.longitude,
        name: p.name,
        address: this.data.route.title,
        scale: 16,
      });
    } catch (e) {
      api.report(e);
    }
  },
  async copyLink() {
    try {
      const route = await api.call('detail', { id: this.id });
      await wx.setClipboardData({ data: core.amapUrl(route) });
      wx.showModal({
        title: '已复制高德路线链接',
        content: '请打开 Safari，将链接粘贴到地址栏并访问，再按提示打开高德。',
        showCancel: false,
        confirmText: '知道了',
      });
    } catch (e) {
      api.report(e);
    }
  },
});
