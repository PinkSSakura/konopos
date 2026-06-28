/**
 * Publish release assets when electron-builder fails on missing remote tag.
 * Uses GH_TOKEN from .env.publish.local.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadPublishEnv } = require('./load-publish-env');

loadPublishEnv();

const owner = process.env.TouDev_GH_OWNER || 'PinkSSakura';
const repo = process.env.TouDev_GH_REPO || 'TouDev';
const token = process.env.GH_TOKEN;
const version = process.argv.find((a) => /^\d+\.\d+\.\d+$/.test(a)) || require('../package.json').version;
const forceReplace = process.argv.includes('--force');
const tag = `v${version}`;
const releaseBuild = path.join(__dirname, '..', '..', '..', 'release-build');
const exeName = `TouDev-Setup-${version}.exe`;

if (!token) {
  console.error('GH_TOKEN missing — set in apps/electron-desktop/.env.publish.local');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function api(method, apiPath, body) {
  const res = await fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${apiPath} → ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('base64');
}

function writeLatestYml() {
  const exePath = path.join(releaseBuild, exeName);
  if (!fs.existsSync(exePath)) throw new Error(`Missing ${exePath}`);
  const stat = fs.statSync(exePath);
  const sha512 = sha512Base64(exePath);
  const yml = [
    `version: ${version}`,
    'files:',
    `  - url: ${exeName}`,
    `    sha512: ${sha512}`,
    `    size: ${stat.size}`,
    `path: ${exeName}`,
    `sha512: ${sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    '',
  ].join('\n');
  const ymlPath = path.join(releaseBuild, 'latest.yml');
  fs.writeFileSync(ymlPath, yml, 'utf8');
  console.log(`Wrote ${ymlPath}`);
  return ymlPath;
}

async function uploadAsset(releaseId, filePath, name) {
  const stat = fs.statSync(filePath);
  const res = await fetch(
    `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(stat.size),
      },
      body: fs.readFileSync(filePath),
      duplex: 'half',
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload ${name} failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  console.log(`Uploaded ${name} (${data.size} bytes)`);
}

async function main() {
  writeLatestYml();

  const remoteMain = await api('GET', `/repos/${owner}/${repo}/commits/main`);
  const targetSha = remoteMain.sha;
  console.log(`Release target (remote main): ${targetSha}`);

  try {
    await api('GET', `/repos/${owner}/${repo}/git/ref/tags/${tag}`);
    console.log(`Tag ${tag} already exists`);
  } catch (e) {
    if (e.status !== 404) throw e;
    await api('POST', `/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/tags/${tag}`,
      sha: targetSha,
    });
    console.log(`Created tag ${tag}`);
  }

  let release;
  try {
    release = await api('GET', `/repos/${owner}/${repo}/releases/tags/${tag}`);
    console.log(`Release ${tag} exists (id ${release.id})`);
  } catch (e) {
    if (e.status !== 404) throw e;
    release = await api('POST', `/repos/${owner}/${repo}/releases`, {
      tag_name: tag,
      name: `TouDev ${version}`,
      body: `TouDev ${version} — silent in-app upgrade install.`,
      draft: false,
      prerelease: false,
    });
    console.log(`Created release ${tag} (id ${release.id})`);
  }

  const assets = [
    [path.join(releaseBuild, exeName), exeName],
    [path.join(releaseBuild, `${exeName}.blockmap`), `${exeName}.blockmap`],
    [path.join(releaseBuild, 'latest.yml'), 'latest.yml'],
  ];

  const existing = new Map((release.assets || []).map((a) => [a.name, a]));
  for (const [filePath, name] of assets) {
    if (!fs.existsSync(filePath)) throw new Error(`Missing ${filePath}`);
    if (existing.has(name)) {
      if (!forceReplace) {
        console.log(`Skip ${name} (already on release)`);
        continue;
      }
      const asset = existing.get(name);
      await api('DELETE', `/repos/${owner}/${repo}/releases/assets/${asset.id}`);
      console.log(`Deleted existing ${name}`);
    }
    await uploadAsset(release.id, filePath, name);
  }

  console.log(`\nDone: https://github.com/${owner}/${repo}/releases/tag/${tag}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
