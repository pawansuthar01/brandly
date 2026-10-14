import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobileDir = resolve(adminDir, '../mobile');
const publicDir = resolve(adminDir, 'public');
const outputDir = resolve(publicDir, 'mobile-preview');
const manifestName = '.brandly-preview-generated.json';
if (!outputDir.startsWith(`${publicDir}${sep}`)) throw new Error('Preview output must stay inside admin public assets.');

const tempRoot = await mkdtemp(resolve(tmpdir(), 'brandly-mobile-preview-'));
const exportDir = resolve(tempRoot, 'export');
const isInside = (root, path) => path.startsWith(`${root}${sep}`);
const safeRelative = (path) => {
  const normalized = path.replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').some((part) => part === '..' || part === '.')) throw new Error(`Unsafe generated preview path: ${path}`);
  return normalized;
};
const collectFiles = async (root, base = root) => {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Expo preview export must not contain symbolic links.');
    if (entry.isDirectory()) files.push(...await collectFiles(path, base));
    else if (entry.isFile()) files.push(safeRelative(relative(base, path)));
  }
  return files;
};
const replaceFile = async (target, contents) => {
  const tempFile = `${target}.tmp-${process.pid}`;
  await writeFile(tempFile, contents);
  try { await rename(tempFile, target); }
  catch (error) { await rm(tempFile, { force: true }); throw error; }
};

try {
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['expo', 'export', '--platform', 'web', '--output-dir', exportDir], {
    cwd: mobileDir,
    env: { ...process.env, BRANDLY_ADMIN_PREVIEW_BUILD: '1' },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Expo web export failed with status ${result.status}.`);

  const htmlPath = resolve(exportDir, 'index.html');
  const html = await readFile(htmlPath, 'utf8');
  if (!html.includes('<html') || !html.match(/<script\b[^>]*src=/i)) throw new Error('Expo preview export has no usable HTML entry point.');
  for (const [, asset] of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
    if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(asset)) {
      if (!asset.startsWith('/mobile-preview/')) continue;
    }
    const pathname = new URL(asset, 'http://preview.local/mobile-preview/index.html').pathname;
    const prefix = '/mobile-preview/';
    if (!pathname.startsWith(prefix)) throw new Error(`Preview asset is not based under /mobile-preview: ${asset}`);
    const local = resolve(exportDir, decodeURIComponent(pathname.slice(prefix.length)));
    if (!isInside(exportDir, local) || !(await stat(local).then(() => true, () => false))) throw new Error(`Preview asset is missing from export: ${asset}`);
  }

  const files = (await collectFiles(exportDir)).filter((file) => file !== manifestName);
  const previousManifestPath = resolve(outputDir, manifestName);
  let previous = { owned: [], preserved: [] };
  if (await stat(previousManifestPath).then(() => true, () => false)) {
    try { previous = JSON.parse(await readFile(previousManifestPath, 'utf8')); }
    catch { throw new Error('Existing preview manifest is invalid; refusing to overwrite user files.'); }
  }
  const owned = new Set((Array.isArray(previous.owned) ? previous.owned : []).map(safeRelative));
  const preserved = new Set((Array.isArray(previous.preserved) ? previous.preserved : []).map(safeRelative));
  await mkdir(outputDir, { recursive: true });

  const orderedFiles = files.filter((file) => file !== 'index.html').concat(files.includes('index.html') ? ['index.html'] : []);
  for (const file of orderedFiles) {
    const source = resolve(exportDir, file);
    const target = resolve(outputDir, file);
    if (!isInside(exportDir, source) || !isInside(outputDir, target)) throw new Error(`Preview path escapes its output directory: ${file}`);
    await mkdir(dirname(target), { recursive: true });
    const exists = await stat(target).then(() => true, () => false);
    if (exists && !owned.has(file)) {
      const [oldContents, newContents] = await Promise.all([readFile(target), readFile(source)]);
      if (!oldContents.equals(newContents)) throw new Error(`Refusing to overwrite an unowned file in mobile-preview: ${file}`);
      preserved.add(file);
      continue;
    }
    await replaceFile(target, await readFile(source));
    owned.add(file);
  }

  await replaceFile(previousManifestPath, JSON.stringify({ owned: [...owned].sort(), preserved: [...preserved].sort() }, null, 2));
  console.log(`Mobile preview exported and verified (${files.length} files).`);
} finally {
  if (!isInside(tmpdir(), exportDir)) throw new Error('Refusing to remove a path outside the temporary directory.');
  await rm(tempRoot, { recursive: true, force: true });
}
