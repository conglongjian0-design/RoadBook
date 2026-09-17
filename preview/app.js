const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
const modeNames = { all: '全部', ...Roadbook.MODES };
let currentUser = null,
  filterMode = 'all',
  keyword = '',
  renderTicket = 0,
  editor = null,
  editorKey = null,
  nextAfterLogin = '';
window.toast = (message) => {
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
};
function icon(name, size = 19) {
  const p = {
    compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm4 5-2 6-6 2 2-6 6-2Z',
    book: 'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4V4Zm16 0h-4a3 3 0 0 0-3 3m7-3v15h-3a4 4 0 0 0-4 2',
    plus: 'M12 5v14M5 12h14',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
    arrow: 'M5 19 19 5M5 5h14v14',
    leaf: 'M5 19C1 7 12 4 21 3c0 9-3 19-14 15M5 21 16 10',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${p[name] || p.compass}"/></svg>`;
}
function shell(content, active = 'explore') {
  return `<div class="shell"><aside class="sidebar"><a class="brand" href="#explore"><span class="brand-icon">${icon('leaf', 28)}</span><span>路书<small>ROADBOOK</small></span></a><a class="nav-link ${active === 'explore' ? 'active' : ''}" href="#explore">${icon('compass')}发现路书</a><a class="nav-link ${active === 'mine' ? 'active' : ''}" href="#mine">${icon('book')}我的路书</a><a class="nav-link ${active === 'edit' ? 'active' : ''}" href="#edit">${icon('plus')}创建路书</a><div class="sidebar-bottom">把喜欢的路留下来，<br>让下一次出发有迹可循。<a class="user-link" href="#profile"><span class="avatar">路</span><span>${esc(currentUser?.nickname || '开启你的旅程')}<br><small>${currentUser ? '本机体验账户' : '登录后制作路书'}</small></span></a></div></aside><main class="main"><header class="topbar"><span>好路线，值得再走一次。</span><span class="mode-badge">本地交互预览 · 非正式小程序</span></header>${content}</main><nav class="mobile-bottom"><a class="${active === 'explore' ? 'active' : ''}" href="#explore">发现路书</a><a class="${active === 'edit' ? 'active' : ''}" href="#edit">＋ 创建</a><a class="${active === 'mine' ? 'active' : ''}" href="#mine">我的路书</a></nav></div>`;
}
function mapSvg(segments, large = false) {
  const width = 520,
    height = large ? 440 : 230,
    projected = Roadbook.project(segments, width, height, large ? 60 : 34),
    ps = projected.flat();
  const paths = projected
    .filter((x) => x.length)
    .map((s) => s.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' '));
  return `<svg class="route-map" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="路线轨迹示意图"><defs><pattern id="grid${large ? 'l' : 's'}" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(-17)"><path d="M34 0H0V34" fill="none" stroke="#e0e5d4" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="#eef1e4"/><path d="M-20 ${height * 0.8}Q130 ${height * 0.15} 260 ${height * 0.4}T550 ${height * 0.1}" fill="none" stroke="#dae6dd" stroke-width="44"/><rect width="100%" height="100%" fill="url(#grid${large ? 'l' : 's'})"/><ellipse cx="110" cy="${height * 0.3}" rx="65" ry="30" fill="#e1e9d4"/><ellipse cx="415" cy="${height * 0.8}" rx="80" ry="30" fill="#e3ead7"/>${paths.map((d) => `<path d="${d}" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#637e47" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}${ps.length ? [ps[0], ps.at(-1)].map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="6" fill="${i ? '#c48351' : '#344d2c'}" stroke="white" stroke-width="3"/>`).join('') : ''}<text x="18" y="${height - 16}" font-size="10" fill="#9ba88a" letter-spacing="2">ROADBOOK</text><text x="${width - 18}" y="${height - 16}" font-size="10" fill="#9ba88a" text-anchor="end">${large ? '路线示意 · 非导航地图' : '路线示意'}</text></svg>`;
}
function card(r) {
  return `<a class="route-card" href="#detail/${encodeURIComponent(r._id)}">${mapSvg(r.segments)}<div class="route-body"><div class="row between"><span class="tag">${esc(Roadbook.MODES[r.mode])} · ${esc(r.city || '未标注城市')}</span><span class="muted small">${r.visibility === 'private' ? '仅自己可见' : r.isDemo ? '示例' : '公开'}</span></div><h3>${esc(r.title)}</h3><div class="row between"><span class="distance">${(r.distanceMeters / 1000).toFixed(1)}<small>km</small></span><span class="small muted">跟着路线，去看看 ${icon('arrow', 12)}</span></div><div class="route-footer"><span>◌ ${esc(r.authorName)}</span><span>${r.source === 'gpx' ? 'GPX 导入' : '路线灵感'}</span></div></div></a>`;
}
async function explore(mine = false) {
  const r =
    mine && !currentUser
      ? { items: [], hasMore: false }
      : await DemoApi.call('list', { mine, mode: filterMode, keyword });
  const intro = mine
    ? ['YOUR LITTLE ATLAS', '我走过的，<br>和还想去的。', '公开与私密，都是你的旅程。']
    : ['FIND YOUR NEXT RIDE', '下一程，<br>想去哪里？', '发现一条路，出发一次。'];
  return shell(
    `<section class="hero"><div><div class="eyebrow">${intro[0]}</div><h1>${intro[1]}</h1><p>${intro[2]}</p></div><div class="hero-actions"><div class="hero-art">${mapSvg(
      [
        Roadbook.gcjToWgs
          ? [
              [121.48, 31.21],
              [121.47, 31.23],
              [121.5, 31.24],
              [121.49, 31.22],
            ].map(([longitude, latitude]) => ({ longitude, latitude }))
          : [],
      ],
    )}</div><button class="primary" data-action="create">＋ 创建路书</button></div></section><div class="search-row"><form id="search-form" class="search-box">${icon('search', 17)}<input id="search" aria-label="搜索路线名称或城市" placeholder="搜索路线名称或城市" value="${esc(keyword)}"></form><div class="filters">${Object.entries(
      modeNames,
    )
      .map(
        ([k, v]) =>
          `<button class="filter ${filterMode === k ? 'active' : ''}" data-action="filter" data-mode="${k}">${v}</button>`,
      )
      .join(
        '',
      )}</div></div><div class="section-head"><h2>${mine ? '我创建的' : '出发灵感'}</h2><span>${mine ? '留住沿途的每一份喜欢' : '每一条路，都值得分享'}</span></div><div class="grid">${r.items.map(card).join('')}</div>${!r.items.length ? `<div class="empty">${mine ? '还没有留下路线' : '暂时没有找到这条路'}<p class="small">${mine ? '上传一份 GPX，或规划一次新的出发。' : '换个关键词，或创建你的第一本路书。'}</p></div>` : ''}${r.hasMore ? '<button data-action="load-more" class="ghost">加载更多</button>' : ''}<div class="note">体验模式：示例轨迹仅用于展示，未经实地核验。创建内容只保存在当前浏览器。</div><div class="footnote">走过的路，成为下一次出发的灵感。</div>`,
    mine ? 'mine' : 'explore',
  );
}
async function detail(id) {
  const r = await DemoApi.call('detail', { id });
  const stops = Roadbook.routeStops(r);
  return shell(
    `<a class="back" href="#explore">← 返回路书广场</a><div class="detail-grid"><div class="map-panel">${mapSvg(r.segments, true)}<div class="map-caption"><span>● 起点　<span style="color:#c48351">● 终点</span></span><span>${r.pointCount} 个轨迹点 · WGS84</span></div></div><article class="detail"><div class="row between"><span class="tag">${esc(Roadbook.MODES[r.mode])} · ${esc(r.city || '未标注城市')}</span><span class="muted small">${r.visibility === 'public' ? '公开路书' : '仅自己可见'}</span></div><h1>${esc(r.title)}</h1><div class="muted small">由 ${esc(r.authorName)} 留下的路线</div><div class="metrics"><div class="metric"><b>${(r.distanceMeters / 1000).toFixed(1)}</b><small>km</small><p>路线距离</p></div><div class="metric"><b>${r.elevationGain === null ? '—' : r.elevationGain}</b><small>${r.elevationGain === null ? '' : 'm'}</small><p>累计上升 · 原始点估算</p></div><div class="metric"><b>${stops.length}</b><p>标记地点</p></div></div><h2>路线与标记点</h2><ol class="stop-list">${stops.map((p, i) => `<li><span class="stop-num">${i + 1}</span><span class="stop-text">${esc(p.name)}<small>${esc(p.role)}</small></span></li>`).join('')}</ol><h2>关于这条路</h2><p class="description">${esc(r.description || '作者还没有留下说明。')}</p><div class="note">地图展示原路书；高德会重新规划路线，实际导航以高德结果为准。</div><div class="actions"><button class="primary" data-action="navigate" data-id="${esc(id)}">高德导航 ↗</button><button data-action="export" data-id="${esc(id)}">导出 GPX</button></div>${r.isOwner ? `<div class="actions"><a class="ghost" href="#edit/${esc(id)}">编辑路书</a><button class="ghost" data-action="delete" data-id="${esc(id)}">删除路书</button></div>` : ''}<div class="muted small" style="margin-top:20px">本地预览不支持跨用户分享；正式小程序提供微信分享。</div></article></div>`,
  );
}
function blankEditor() {
  return {
    title: '',
    description: '',
    city: '',
    mode: 'cycling',
    visibility: 'private',
    segments: [],
    waypoints: [],
    source: 'demo',
    tab: 'plan',
  };
}
async function edit(id) {
  if (!currentUser) {
    nextAfterLogin = id ? 'edit/' + id : 'edit';
    return profile();
  }
  const key = id || 'new';
  if (editorKey !== key) {
    editor = id ? await DemoApi.call('detail', { id }) : blankEditor();
    if (id && !editor.isOwner) throw new Error('无权编辑');
    editor.tab = editor.source === 'gpx' ? 'import' : 'plan';
    editorKey = key;
  }
  const r = editor;
  return shell(
    `<div class="editor"><a class="back" href="#mine">← 返回我的路书</a><div class="eyebrow">MAKE YOUR OWN WAY</div><h1>${id ? '编辑这条路' : '留下一条好路线'}</h1><div class="muted small">从一份轨迹，或一个想去的地方开始。</div><div class="tabs"><button class="filter ${r.tab === 'plan' ? 'active' : ''}" data-action="editor-tab" data-tab="plan">手动规划</button><button class="filter ${r.tab === 'import' ? 'active' : ''}" data-action="editor-tab" data-tab="import">导入 GPX</button></div>${
      r.tab === 'import'
        ? `<div class="panel"><h2>带上你已有的路线</h2><p>支持 GPX 文件，最多 3 MB、8000 个轨迹点。</p><div class="file-drop">${icon('book', 30)}<p>选择你保存的 GPX 文件</p><input type="file" accept=".gpx,application/gpx+xml" id="gpx-file" aria-label="选择 GPX 文件"></div></div>`
        : `<div class="panel"><h2>想经过哪些地方？</h2><p>浏览器预览使用 GCJ-02 坐标演示选点；正式小程序通过地图搜索选择地点。</p><div class="plan-stop stop-headers"><span></span><span>地点名称</span><span>经度</span><span>纬度</span><span></span></div>${r.waypoints
            .map((p, i) => {
              const q = Roadbook.wgsToGcj(p);
              return `<div class="plan-stop"><span class="stop-num">${i + 1}</span><input class="stop-input" aria-label="地点${i + 1}名称" data-stop="${i}" data-key="name" value="${esc(p.name)}"><input class="stop-input" type="number" step="any" aria-label="地点${i + 1}经度" data-stop="${i}" data-key="longitude" value="${q.longitude.toFixed(6)}"><input class="stop-input" type="number" step="any" aria-label="地点${i + 1}纬度" data-stop="${i}" data-key="latitude" value="${q.latitude.toFixed(6)}"><button data-action="remove-stop" data-index="${i}" aria-label="删除地点${i + 1}">×</button></div>`;
            })
            .join(
              '',
            )}<div class="actions"><button data-action="add-stop">＋ 添加地点</button><button class="primary" data-action="plan" ${r.waypoints.length < 2 ? 'disabled' : ''}>生成示意路线</button></div><div class="note warning">演示模式只连接地点，不调用真实道路规划。正式版由高德服务生成道路轨迹。</div></div>`
    }${r.segments.length ? `${mapSvg(r.segments)}<div class="note">${(Roadbook.stats(r.segments).distanceMeters / 1000).toFixed(1)} km · ${Roadbook.stats(r.segments).pointCount} 个轨迹点${r.source === 'demo' ? ' · 仅为示意连线，不可作为通行依据' : ''}</div>` : ''}<form id="editor-form"><label class="field">路线名称<input name="title" maxlength="60" required placeholder="给这次出发起个名字" value="${esc(r.title)}"></label><label class="field">出行方式<select name="mode">${Object.entries(
      Roadbook.MODES,
    )
      .map(([k, v]) => `<option value="${k}" ${r.mode === k ? 'selected' : ''}>${v}</option>`)
      .join(
        '',
      )}</select></label><label class="field">所在城市（选填）<input name="city" maxlength="30" placeholder="例如：上海" value="${esc(r.city)}"></label><label class="field">路线说明（选填）<textarea name="description" maxlength="2000" placeholder="沿途的风景、补给点，或想提醒同行者的事…">${esc(r.description)}</textarea></label><div class="panel"><label class="toggle"><input name="visibility" type="checkbox" ${r.visibility === 'public' ? 'checked' : ''}><span>公开这本路书<small class="muted" style="display:block">关闭后仅自己可见</small></span></label></div><div class="save-bar"><button class="primary" type="submit">保存路书</button></div></form></div>`,
    'edit',
  );
}
function profile() {
  return shell(
    `<section class="profile"><div class="eyebrow">NICE TO MEET YOU</div><h1>以你的名字，<br>留下一条路。</h1><p class="muted small">从一次出发，认识更多热爱在路上的人。</p><div class="note">当前是本机体验身份。真实微信登录需要注册小程序并接入腾讯云开发。</div>${currentUser ? `<form id="profile-form"><div class="avatar">路</div><label class="field">昵称<input name="nickname" required maxlength="30" value="${esc(currentUser.nickname)}" placeholder="填写你的昵称"></label><button class="primary" type="submit">保存资料</button></form>` : '<button class="primary" data-action="login">使用体验身份</button>'}</section>`,
    'mine',
  );
}
async function render() {
  const ticket = ++renderTicket;
  const [page = 'explore', encoded] = location.hash.slice(1).split('/'),
    id = encoded ? decodeURIComponent(encoded) : undefined;
  try {
    currentUser = await DemoApi.call('session');
    let html;
    if (page === 'detail') html = await detail(id);
    else if (page === 'edit') html = await edit(id);
    else if (page === 'profile') html = profile();
    else html = await explore(page === 'mine');
    if (ticket !== renderTicket) return;
    $('#app').innerHTML = html;
    window.scrollTo(0, 0);
  } catch (e) {
    $('#app').innerHTML = shell(
      `<a href="#explore" class="back">← 返回广场</a><div class="error">${esc(e.message)}</div>`,
    );
  }
}
async function download(id) {
  const r = await DemoApi.call('detail', { id }),
    url = URL.createObjectURL(new Blob([Roadbook.exportGpx(r)], { type: 'application/gpx+xml' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = r.title.replace(/[\\/:*?"<>|]/g, '_') + '.gpx';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('GPX 文件已生成');
}
async function navigation(id) {
  const r = await DemoApi.call('detail', { id }),
    url = Roadbook.amapUrl(r);
  const d = $('#dialog');
  d.innerHTML = `<button class="close" data-action="close-dialog" aria-label="关闭">×</button><div class="eyebrow">READY TO GO</div><h2>把路线带上，现在出发。</h2><p>${esc(r.title)} · ${esc(Roadbook.MODES[r.mode])}</p><div class="note">高德会重新规划，实际导航路线以高德为准。</div><div class="step"><span class="stop-num">1</span><span class="small">在 iPhone 的 Safari 中打开高德路线链接</span></div><div class="step"><span class="stop-num">2</span><span class="small">按提示打开已安装的高德 App</span></div><a class="primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">打开高德路线 ↗</a><div class="actions"><button data-action="copy-amap" data-id="${esc(id)}">复制路线链接</button></div><p>这是浏览器预览。正式小程序另提供微信位置页入口；从微信到 iPhone 高德的实际操作仍需真机验收。</p>${Roadbook.distance(...Object.values(Roadbook.endpoints(r))) < 30 ? '<div class="note warning">环线起终点相同，高德可能生成零距离路线。</div>' : ''}`;
  d.showModal();
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  try {
    if (a === 'create') {
      if (!currentUser) {
        nextAfterLogin = 'edit';
        location.hash = '#profile';
      } else {
        editorKey = null;
        location.hash = '#edit';
      }
    }
    if (a === 'filter') {
      filterMode = b.dataset.mode;
      await render();
    }
    if (a === 'login') {
      currentUser = await DemoApi.call('login');
      await render();
    }
    if (a === 'editor-tab') {
      editor.tab = b.dataset.tab;
      await render();
    }
    if (a === 'add-stop') {
      if (editor.waypoints.length >= 20) throw new Error('最多支持 20 个地点');
      const i = editor.waypoints.length;
      editor.waypoints.push({
        ...Roadbook.gcjToWgs({ longitude: 121.485 + i * 0.008, latitude: 31.235 - i * 0.009 }),
        name: i === 0 ? '起点' : '地点 ' + (i + 1),
      });
      editor.segments = [];
      await render();
    }
    if (a === 'remove-stop') {
      editor.waypoints.splice(Number(b.dataset.index), 1);
      editor.segments = [];
      await render();
    }
    if (a === 'plan') {
      const result = await DemoApi.call('plan', { waypoints: editor.waypoints, mode: editor.mode });
      editor.segments = result.segments;
      editor.source = 'demo';
      await render();
    }
    if (a === 'export') await download(b.dataset.id);
    if (a === 'navigate') await navigation(b.dataset.id);
    if (a === 'close-dialog') $('#dialog').close();
    if (a === 'copy-amap') {
      const r = await DemoApi.call('detail', { id: b.dataset.id });
      await navigator.clipboard.writeText(Roadbook.amapUrl(r));
      toast('已复制，请在 iPhone Safari 中打开');
    }
    if (a === 'delete') {
      if (confirm('删除这本路书？删除后无法恢复。')) {
        await DemoApi.call('delete', { id: b.dataset.id });
        location.hash = '#mine';
        toast('路书已删除');
      }
    }
    if (a === 'load-more') {
      const mine = location.hash === '#mine';
      const offset = document.querySelectorAll('.route-card').length;
      const r = await DemoApi.call('list', { mine, mode: filterMode, keyword, offset });
      $('.grid').insertAdjacentHTML('beforeend', r.items.map(card).join(''));
      if (!r.hasMore) b.remove();
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener('input', (e) => {
  const input = e.target;
  if (input.form?.id === 'editor-form' && editor && input.name && input.name !== 'visibility')
    editor[input.name] = input.value;
});
document.addEventListener('change', async (e) => {
  try {
    const input = e.target;
    if (input.id === 'gpx-file') {
      const f = input.files[0];
      if (!f) return;
      if (f.size > 3 * 1024 * 1024) throw new Error('文件不能超过 3 MB');
      const r = Roadbook.parseGpx(await f.text());
      editor.segments = r.segments;
      editor.waypoints = r.waypoints;
      editor.source = 'gpx';
      if (!editor.title) editor.title = r.title;
      await render();
      toast('GPX 已导入');
    }
    if (input.dataset.stop !== undefined) {
      const i = Number(input.dataset.stop),
        p = editor.waypoints[i],
        k = input.dataset.key;
      if (k === 'name') p.name = input.value;
      else {
        const gcj = Roadbook.wgsToGcj(p);
        gcj[k] = Number(input.value);
        if (!Roadbook.validPoint(gcj) || !input.value) throw new Error('请输入有效经纬度');
        editor.waypoints[i] = { ...Roadbook.gcjToWgs(gcj), name: p.name };
      }
      editor.segments = [];
    }
    if (input.name === 'visibility' && editor)
      editor.visibility = input.checked ? 'public' : 'private';
    if (input.name === 'mode' && editor) {
      editor.mode = input.value;
      if (editor.source !== 'gpx') editor.segments = [];
      await render();
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    if (form.id === 'search-form') {
      keyword = $('#search').value.trim();
      await render();
    }
    if (form.id === 'profile-form') {
      const nickname = new FormData(form).get('nickname');
      currentUser = await DemoApi.call('profile', { nickname, avatarUrl: '' });
      toast('资料已保存');
      if (nextAfterLogin) {
        location.hash = '#' + nextAfterLogin;
        nextAfterLogin = '';
      } else location.hash = '#mine';
    }
    if (form.id === 'editor-form') {
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      try {
        const r = await DemoApi.call('save', {
          id: editor._id,
          version: editor.version,
          route: editor,
        });
        editorKey = null;
        editor = null;
        location.hash = '#detail/' + encodeURIComponent(r._id);
        toast('路书已保存');
      } finally {
        button.disabled = false;
      }
    }
  } catch (err) {
    toast(err.message);
  }
});
window.addEventListener('hashchange', () => {
  if (!location.hash.startsWith('#edit')) editorKey = null;
  render();
});
render();
