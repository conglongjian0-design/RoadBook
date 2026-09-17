const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process');
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() && !['node_modules', '.git', 'artifacts'].includes(e.name)
        ? walk(path.join(dir, e.name))
        : e.isFile()
          ? [path.join(dir, e.name)]
          : [],
    );
}
for (const f of [
  ...walk('miniprogram'),
  ...walk('cloudfunctions'),
  ...walk('shared'),
  ...walk('scripts'),
  ...walk('preview'),
]) {
  if (f.endsWith('.js')) cp.execFileSync(process.execPath, ['--check', f]);
  if (f.endsWith('.json')) JSON.parse(fs.readFileSync(f, 'utf8'));
  if (f.endsWith('.wxml')) {
    const source = fs.readFileSync(f, 'utf8');
    for (const match of source.matchAll(/wx:(?:if|elif|for)="([^"]*)"/g)) {
      if (!match[1].startsWith('{{') || !match[1].endsWith('}}'))
        throw new Error(`${f}: ${match[0]} must use WXML data binding, not a literal string`);
    }
  }
}
const app = require('../miniprogram/app.json');
for (const page of app.pages)
  for (const ext of ['js', 'json', 'wxml', 'wxss'])
    if (!fs.existsSync('miniprogram/' + page + '.' + ext))
      throw new Error('Missing page file ' + page + '.' + ext);
console.log(
  'JavaScript syntax, JSON, WXML dynamic bindings and mini program page manifests passed.',
);
