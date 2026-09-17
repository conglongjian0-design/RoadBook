const api = require('../../services/api'),
  core = require('../../lib/core');
const DRAFT = 'roadbook-editor-draft-v1';
Page({
  data: {
    id: '',
    version: null,
    isDemo: api.isDemo,
    tab: 'plan',
    title: '',
    city: '',
    description: '',
    mode: 'cycling',
    visibility: 'private',
    segments: [],
    waypoints: [],
    source: 'planned',
    distanceLabel: '0.0',
    pointCount: 0,
    planning: false,
    saving: false,
    loading: false,
    error: '',
    modes: [
      { value: 'cycling', label: '骑行' },
      { value: 'walking', label: '步行' },
      { value: 'driving', label: '自驾' },
    ],
  },
  async onLoad(q) {
    this.setData({ loading: true });
    try {
      if (q.id) {
        const r = await api.call('detail', { id: q.id });
        if (!r.isOwner) throw new Error('无权编辑此路书');
        this.setData({
          id: r._id,
          version: r.version,
          title: r.title,
          city: r.city,
          description: r.description,
          mode: r.mode,
          visibility: r.visibility,
          segments: r.segments,
          waypoints: r.waypoints,
          source: r.source,
          tab: r.source === 'gpx' ? 'import' : 'plan',
        });
        this.stats();
      } else {
        const draft = wx.getStorageSync(DRAFT);
        if (draft) {
          const { confirm } = await wx.showModal({
            title: '继续上次的草稿？',
            content: '你有一条还没有保存的路线。',
            confirmText: '继续编辑',
            cancelText: '重新开始',
          });
          if (confirm) {
            this.setData(draft);
            this.stats();
          } else wx.removeStorageSync(DRAFT);
        }
      }
    } catch (e) {
      this.setData({ error: e.message });
      this.blocked = true;
    } finally {
      this.setData({ loading: false });
    }
  },
  onHide() {
    this.persist();
  },
  onUnload() {
    this.persist();
  },
  persist() {
    if (this.saved || this.data.id || this.blocked) return;
    const d = this.data;
    if (!d.title && !d.waypoints.length && !d.segments.length) return;
    const draft = {};
    [
      'title',
      'city',
      'description',
      'mode',
      'visibility',
      'segments',
      'waypoints',
      'source',
      'tab',
    ].forEach((k) => (draft[k] = d[k]));
    try {
      wx.setStorageSync(DRAFT, draft);
    } catch {}
  },
  input(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },
  visibility(e) {
    this.setData({ visibility: e.detail.value ? 'public' : 'private' });
  },
  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab, error: '' });
  },
  invalidate() {
    this.planTicket = (this.planTicket || 0) + 1;
    this.setData({ segments: [], error: '', pointCount: 0, distanceLabel: '0.0', planning: false });
  },
  setMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.mode) return;
    this.setData({ mode });
    if (this.data.source !== 'gpx') this.invalidate();
  },
  async pick(index) {
    try {
      const result = await wx.chooseLocation({});
      const p = {
        ...core.gcjToWgs({ latitude: result.latitude, longitude: result.longitude }),
        name: result.name || result.address || '地图选点',
      };
      const waypoints = this.data.waypoints.slice();
      if (index === undefined) waypoints.push(p);
      else waypoints[index] = p;
      this.setData({ waypoints });
      this.invalidate();
    } catch (e) {
      api.report(e);
    }
  },
  addStop() {
    this.pick();
  },
  replaceStop(e) {
    this.pick(Number(e.currentTarget.dataset.index));
  },
  removeStop(e) {
    const ps = this.data.waypoints.slice();
    ps.splice(Number(e.currentTarget.dataset.index), 1);
    this.setData({ waypoints: ps });
    this.invalidate();
  },
  moveUp(e) {
    const i = Number(e.currentTarget.dataset.index),
      ps = this.data.waypoints.slice();
    [ps[i - 1], ps[i]] = [ps[i], ps[i - 1]];
    this.setData({ waypoints: ps });
    this.invalidate();
  },
  stats() {
    const s = core.stats(this.data.segments);
    this.setData({ distanceLabel: (s.distanceMeters / 1000).toFixed(1), pointCount: s.pointCount });
  },
  async plan() {
    if (this.data.planning) return;
    const ticket = (this.planTicket || 0) + 1;
    this.planTicket = ticket;
    this.setData({ planning: true, error: '' });
    try {
      const r = await api.call('plan', { waypoints: this.data.waypoints, mode: this.data.mode });
      if (ticket !== this.planTicket) return;
      this.setData({ segments: r.segments, source: r.source });
      this.stats();
    } catch (e) {
      if (ticket === this.planTicket) this.setData({ error: e.message });
    } finally {
      if (ticket === this.planTicket) this.setData({ planning: false });
    }
  },
  async importFile() {
    try {
      const { tempFiles } = await wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['gpx'],
      });
      const f = tempFiles[0];
      if (f.size > 3 * 1024 * 1024) throw new Error('请选择 3 MB 内的 GPX 文件');
      const text = await new Promise((resolve, reject) =>
        wx
          .getFileSystemManager()
          .readFile({
            filePath: f.path,
            encoding: 'utf8',
            success: (r) => resolve(r.data),
            fail: reject,
          }),
      );
      const r = core.parseGpx(text);
      this.planTicket = (this.planTicket || 0) + 1;
      this.setData({
        segments: r.segments,
        waypoints: r.waypoints,
        title: this.data.title || r.title,
        source: 'gpx',
        error: '',
        planning: false,
      });
      this.stats();
    } catch (e) {
      api.report(e);
    }
  },
  async save() {
    if (this.data.saving || this.blocked) return;
    this.setData({ saving: true, error: '' });
    try {
      if (!(await api.requireLogin())) return;
      const d = this.data,
        route = core.validateRoute(d);
      const r = await api.call('save', { id: d.id || undefined, version: d.version, route });
      this.saved = true;
      wx.removeStorageSync(DRAFT);
      wx.redirectTo({ url: '/pages/detail/index?id=' + encodeURIComponent(r._id) });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ saving: false });
    }
  },
});
