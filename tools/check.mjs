import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];

const requiredFiles = [
  '.github/workflows/build-macos.yml',
  'index.html',
  'package.json',
  'vite.config.js',
  'README.md',
  'README.en.md',
  'PRIVACY.md',
  'LICENSE',
  '.gitignore',
  'assets/icons/icon-16.png',
  'assets/icons/icon-32.png',
  'assets/icons/icon-128.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'public/assets/icons/icon-16.png',
  'public/assets/icons/icon-32.png',
  'public/assets/icons/icon-128.png',
  'public/assets/icons/icon-192.png',
  'public/assets/icons/icon-512.png',
  'src/main.js',
  'src/styles.css',
  'src/core/api.js',
  'src/core/constants.js',
  'src/core/desktop.js',
  'src/core/normalize.js',
  'src/core/storage.js',
  'src/core/subscriptions.js',
  'src-tauri/Cargo.toml',
  'src-tauri/build.rs',
  'src-tauri/src/main.rs',
  'src-tauri/src/lib.rs',
  'src-tauri/tauri.conf.json',
  'src-tauri/capabilities/default.json',
  'src-tauri/icons/32x32.png',
  'src-tauri/icons/128x128.png',
  'src-tauri/icons/128x128@2x.png',
  'src-tauri/icons/icon.png',
  'src-tauri/icons/icon.icns',
  'src-tauri/Entitlements.plist',
  'src-tauri/Info.plist',
  'docs/architecture.md',
  'docs/release-builds.md',
  'docs/user-research.md',
  'tests/api.test.mjs',
  'tests/normalize.test.mjs',
  'tests/storage.test.mjs',
  'tests/subscriptions.test.mjs',
  'tools/check.mjs',
  'tools/build-package.ps1'
];

for (const file of requiredFiles) await mustExist(file);
await checkJson();
await checkSyntax();
await checkPackage();
await checkTauriConfig();
await checkDocs();
await checkForbiddenFiles();
await checkForbiddenText();

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, files: (await listFiles(root)).length, package: 'ddys-macos' }, null, 2));

async function checkJson() {
  for (const full of await listFiles(root)) {
    const rel = slash(path.relative(root, full));
    if (!/\.json$/i.test(rel)) continue;
    try {
      JSON.parse(await fs.readFile(full, 'utf8'));
    } catch (error) {
      assert(false, `${rel} is not valid JSON: ${error.message}`);
    }
  }
}

async function checkSyntax() {
  for (const full of await listFiles(root)) {
    const rel = slash(path.relative(root, full));
    if (!/\.(js|mjs)$/i.test(rel)) continue;
    const result = spawnSync(process.execPath, ['--check', full], { stdio: 'inherit' });
    assert(result.status === 0, `${rel} failed node --check.`);
  }
}

async function checkPackage() {
  const pkg = JSON.parse(await read('package.json'));
  assert(pkg.name === 'ddys-macos', 'package name mismatch.');
  assert(pkg.version === '0.1.0', 'package version mismatch.');
  assert(pkg.private === true, 'macOS package must be private.');
  assert((await read('src/core/constants.js')).includes(`VERSION = '${pkg.version}'`), 'runtime version must match package.json.');
  assert((await read('src-tauri/tauri.conf.json')).includes(`"version": "${pkg.version}"`), 'Tauri version must match package.json.');
  assert((await read('src-tauri/Cargo.toml')).includes(`version = "${pkg.version}"`), 'Cargo version must match package.json.');
  assert(pkg.scripts?.tauri === 'tauri', 'package tauri script missing.');
}

async function checkTauriConfig() {
  const config = JSON.parse(await read('src-tauri/tauri.conf.json'));
  assert(config.identifier === 'io.ddys.macos', 'Tauri identifier mismatch.');
  assert(config.build?.frontendDist === '../dist', 'Tauri frontendDist mismatch.');
  assert(config.app?.withGlobalTauri === true, 'Tauri global API should be enabled for macOS helpers.');
  assert(config.bundle?.targets?.includes('app'), 'macOS app target missing.');
  assert(config.bundle?.targets?.includes('dmg'), 'macOS DMG target missing.');
  assert(config.bundle?.macOS?.minimumSystemVersion === '11.0', 'macOS minimum system version mismatch.');
  assert(config.bundle?.macOS?.entitlements === 'Entitlements.plist', 'macOS entitlements missing.');
  assert(config.bundle?.macOS?.infoPlist === 'Info.plist', 'macOS Info.plist missing.');
  assert(config.bundle?.macOS?.signingIdentity === '-', 'macOS ad-hoc signing identity missing.');
  const workflow = await read('.github/workflows/build-macos.yml');
  assert(workflow.includes('tauri-apps/tauri-action@v1'), 'macOS workflow must use tauri-action.');
  assert(workflow.includes('aarch64-apple-darwin'), 'macOS Apple Silicon target missing.');
  assert(workflow.includes('x86_64-apple-darwin'), 'macOS Intel target missing.');
  assert(workflow.includes('releaseAssetNamePattern'), 'macOS workflow release asset naming missing.');
  const caps = JSON.parse(await read('src-tauri/capabilities/default.json'));
  assert(caps.permissions.includes('core:default'), 'core permission missing.');
  assert(caps.permissions.includes('opener:default'), 'opener permission missing.');
  assert(caps.permissions.includes('notification:default'), 'notification permission missing.');
}

async function checkDocs() {
  const readme = await read('README.md');
  for (const fragment of ['macOS', '发现', '搜索', '订阅', '导入导出', '隐私']) {
    assert(readme.includes(fragment), `README.md missing ${fragment}.`);
  }
  assert(readme.includes('API Key'), 'README.md missing API Key.');
  const research = await read('docs/user-research.md');
  for (const fragment of ['Tauri v2', 'WKWebView', '托盘', '通知', '本地数据', 'DMG']) {
    assert(research.includes(fragment), `user-research missing ${fragment}.`);
  }
  const releaseBuilds = await read('docs/release-builds.md');
  for (const fragment of ['GitHub Actions', 'aarch64-apple-darwin', 'x86_64-apple-darwin', 'DMG', 'ad-hoc']) {
    assert(releaseBuilds.includes(fragment), `release-builds missing ${fragment}.`);
  }
}

async function checkForbiddenFiles() {
  for (const full of await listFiles(root)) {
    const rel = slash(path.relative(root, full));
    assert(!/(^|\/)(node_modules|coverage|package|\.git)(\/|$)/.test(rel), `forbidden path: ${rel}`);
    assert(!/\.(log|tmp|cache|tgz)$/i.test(rel), `forbidden file: ${rel}`);
    assert(!/(^|\/)\.env(\.|$)/.test(rel), `forbidden env file: ${rel}`);
    assert(!['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'Cargo.lock'].includes(path.basename(rel)), `forbidden lockfile: ${rel}`);
  }
}

async function checkForbiddenText() {
  const patterns = ['ghp_', 'github_pat_', 'npm_', '\uFFFD'];
  for (const full of await listFiles(root)) {
    const rel = slash(path.relative(root, full));
    if (!isTextFile(rel) || rel === 'tools/check.mjs') continue;
    const text = await fs.readFile(full, 'utf8');
    for (const pattern of patterns) assert(!text.includes(pattern), `${rel} contains forbidden text pattern ${pattern}.`);
  }
}

async function mustExist(rel) {
  try {
    await fs.stat(path.join(root, rel));
  } catch {
    failures.push(`Missing required file: ${rel}`);
  }
}

async function read(rel) {
  return fs.readFile(path.join(root, rel), 'utf8');
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (['.git', 'node_modules', 'dist', 'coverage', 'package'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(full));
    else out.push(full);
  }
  return out;
}

function isTextFile(rel) {
  return /\.(js|mjs|json|html|css|md|txt|ps1|toml|rs|yml|yaml|plist)$/i.test(rel) || rel === '.gitignore' || rel === 'LICENSE';
}

function slash(value) {
  return value.replace(/\\/g, '/');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
