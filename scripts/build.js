const esbuild = require('esbuild');
const fs = require('node:fs');
(async () => {
  for (const outfile of ['miniprogram/lib/core.js', 'cloudfunctions/roadbook/core.js'])
    await esbuild.build({
      entryPoints: ['shared/index.js'],
      bundle: true,
      platform: 'browser',
      format: 'cjs',
      target: 'es2018',
      outfile,
      legalComments: 'none',
    });
  await esbuild.build({
    entryPoints: ['shared/index.js'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'Roadbook',
    target: 'es2020',
    outfile: 'preview/core.js',
  });
  fs.copyFileSync('shared/fixtures.js', 'miniprogram/lib/fixtures.js');
  fs.copyFileSync('shared/fixtures.js', 'preview/fixtures.js');
  await esbuild.build({
    entryPoints: ['miniprogram/services/api.js'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'DemoApi',
    target: 'es2020',
    outfile: 'preview/api.js',
    plugins: [
      {
        name: 'demo-config',
        setup(build) {
          build.onLoad({ filter: /miniprogram\/config\.js$/ }, () => ({
            contents: "module.exports={mode:'demo'}",
            loader: 'js',
          }));
        },
      },
    ],
  });
  console.log('Built mini program, cloud function and browser preview.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
