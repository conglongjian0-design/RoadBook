const api = require('../../services/api'),
  core = require('../../lib/core');
Page({
  data: {
    route: null,
    isDemo: api.isDemo,
    loading: true,
    error: '',
    exportReady: false,
    canShare: false,
  },
  onLoad(q) {
    this.id = q.id;
    wx.hideShareMenu();
  },
  onShow() {
    this.reload();
  },
  async reload() {
    this.exportPath = '';
    this.exportFilename = '';
    this.setData({ loading: true, error: '', route: null, exportReady: false, canShare: false });
    wx.hideShareMenu();
    try {
      const r = await api.call('detail', { id: this.id });
      const all = r.segments.flat(),
        start = all[0],
        end = all[all.length - 1];
      const stops = core.routeStops(r);
      const view = core.summarize(r);
      const markers = [
        {
          ...core.wgsToGcj(start),
          id: 1,
          width: 22,
          height: 30,
          label: { content: '起点', color: '#344d2c', bgColor: '#ffffff', padding: 5 },
        },
        {
          ...core.wgsToGcj(end),
          id: 2,
          width: 22,
          height: 30,
          label: { content: '终点', color: '#a16639', bgColor: '#ffffff', padding: 5 },
        },
      ];
      const { segments, previewSegments, ...metadata } = r;
      const fullMapped = segments.map((s) =>
        s.map((p) => {
          const c = core.wgsToGcj(p);
          return { latitude: c.latitude, longitude: c.longitude };
        }),
      );
      const allMapped = fullMapped.flat(),
        latitudes = allMapped.map((p) => p.latitude),
        longitudes = allMapped.map((p) => p.longitude);
      const bounds = [
        { latitude: Math.min(...latitudes), longitude: Math.min(...longitudes) },
        { latitude: Math.max(...latitudes), longitude: Math.max(...longitudes) },
      ];
      let exportReady = false;
      try {
        await this.prepareExport(r);
        exportReady = true;
      } catch {}
      this.setData({
        route: { ...metadata, distanceLabel: view.distanceLabel, modeLabel: view.modeLabel },
        center: core.wgsToGcj(start),
        polylines: fullMapped.map((points) => ({
          points,
          color: '#537842',
          width: 5,
          borderColor: '#ffffff',
          borderWidth: 2,
        })),
        markers,
        includePoints: bounds,
        stops,
        stopCount: stops.length,
        elevationLabel: r.elevationGain === null ? '—' : String(r.elevationGain),
        exportReady,
        canShare: !api.isDemo && r.visibility === 'public',
      });
      if (!api.isDemo && r.visibility === 'public')
        wx.showShareMenu({ menus: ['shareAppMessage'] });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ loading: false });
    }
  },
  navigate() {
    wx.navigateTo({ url: '/pages/navigate/index?id=' + encodeURIComponent(this.id) });
  },
  edit() {
    wx.navigateTo({ url: '/pages/editor/index?id=' + encodeURIComponent(this.id) });
  },
  prepareExport(route) {
    const filename =
        (route.title.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 40) || '路书') + '.gpx',
      path = wx.env.USER_DATA_PATH + '/' + filename,
      text = core.exportGpx(route);
    return new Promise((resolve, reject) =>
      wx.getFileSystemManager().writeFile({
        filePath: path,
        data: text,
        encoding: 'utf8',
        success: () => {
          this.exportPath = path;
          this.exportFilename = filename;
          resolve();
        },
        fail: reject,
      }),
    );
  },
  exportFile() {
    if (!this.exportPath) {
      api.report(new Error('GPX 文件正在准备，请稍后再试'));
      return;
    }
    if (!wx.shareFileMessage) {
      api.report(new Error('请更新微信后再导出文件'));
      return;
    }
    // WeChat requires this API to be invoked directly in the user tap stack.
    wx.shareFileMessage({
      filePath: this.exportPath,
      fileName: this.exportFilename,
      fail: api.report,
    });
  },
  async remove() {
    const { confirm } = await wx.showModal({
      title: '删除这本路书？',
      content: '删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#a24d38',
    });
    if (!confirm) return;
    try {
      await api.call('delete', { id: this.id });
      wx.switchTab({ url: '/pages/mine/index' });
    } catch (e) {
      api.report(e);
    }
  },
  onShareAppMessage() {
    return this.data.canShare
      ? {
          title: this.data.route.title,
          path: '/pages/detail/index?id=' + encodeURIComponent(this.id),
        }
      : { title: '路书 · 把喜欢的路留下来', path: '/pages/explore/index' };
  },
});
