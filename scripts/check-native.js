const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'),
  mini = path.join(root, 'miniprogram');
const compilerDir =
  process.env.WECHAT_COMPILER_DIR ||
  '/Applications/wechatwebdevtools.app/Contents/Resources/app.asar.unpacked/node_modules/wcc-exec';
if (!fs.existsSync(path.join(compilerDir, 'wcc'))) {
  console.log(
    'SKIP native compilation: set WECHAT_COMPILER_DIR to the official WeChat compiler directory.',
  );
  process.exit(0);
}
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
for (const [ext, bin] of [
  ['wxml', 'wcc'],
  ['wxss', 'wcsc'],
]) {
  const files = walk(mini)
    .filter((f) => f.endsWith('.' + ext))
    .map((f) => path.relative(mini, f));
  cp.execFileSync(
    path.join(compilerDir, bin),
    ['-o', path.join(root, 'artifacts', 'compiled-' + ext + '.js'), ...files],
    { cwd: mini, stdio: 'pipe' },
  );
  console.log(`${bin}: ${files.length} ${ext.toUpperCase()} files compiled successfully.`);
}

// A literal wx:if/wx:for can compile successfully but render the wrong page.
// Exercise the official compiler output with representative application states.
const context = vm.createContext({ window: {}, console });
vm.runInContext(fs.readFileSync(path.join(root, 'artifacts/compiled-wxml.js'), 'utf8'), context);
function textOf(node) {
  return typeof node === 'string' ? node : (node?.children || []).map(textOf).join(' ');
}
function render(name, data) {
  return textOf(context.$gwx(`pages/${name}/index.wxml`)(data));
}
const editorState = {
  tab: 'plan',
  isDemo: false,
  error: '',
  segments: [],
  modes: [],
  waypoints: [{ name: '测试起点甲' }, { name: '测试终点乙' }],
};
const planned = render('editor', editorState);
assert.match(planned, /想经过哪些地方/);
assert.match(planned, /测试起点甲/);
assert.match(planned, /测试终点乙/);
assert.doesNotMatch(planned, /体验模式|选择 GPX 文件/);
const imported = render('editor', { ...editorState, tab: 'import' });
assert.match(imported, /选择 GPX 文件/);
assert.doesNotMatch(imported, /想经过哪些地方/);
const loggedOut = render('profile', { user: null, isDemo: false });
assert.match(loggedOut, /微信登录/);
assert.doesNotMatch(loggedOut, /保存资料/);
const loggedIn = render('profile', { user: { nickname: '测试骑友' }, isDemo: false });
assert.match(loggedIn, /保存资料/);
assert.doesNotMatch(loggedIn, /微信登录/);
const populated = render('explore', {
  routes: [
    { _id: 'a', title: '第一条验收路线' },
    { _id: 'b', title: '第二条验收路线' },
  ],
  modes: [],
  loading: false,
  error: '',
  isDemo: false,
});
assert.match(populated, /第一条验收路线/);
assert.match(populated, /第二条验收路线/);
assert.doesNotMatch(populated, /这里还没有路书|正在寻找/);
const empty = render('explore', { routes: [], modes: [], loading: false, error: '' });
assert.match(empty, /这里还没有路书/);
console.log(
  'Official WXML runtime: route lists, empty state, editor tabs and login states passed.',
);
