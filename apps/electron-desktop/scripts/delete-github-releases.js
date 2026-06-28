/**
 * Delete GitHub releases by tag (e.g. node delete-github-releases.js v3.3.1 v3.3.2)
 */
const { loadPublishEnv } = require('./load-publish-env');

loadPublishEnv();

const owner = process.env.TouDev_GH_OWNER || process.env.KONOPOS_GH_OWNER || 'PinkSSakura';
const repo = process.env.TouDev_GH_REPO || process.env.KONOPOS_GH_REPO || 'konopos';
const token = process.env.GH_TOKEN;
const tags = process.argv.slice(2).filter((arg) => arg.startsWith('v'));

if (!token) {
  console.error('GH_TOKEN missing — set in apps/electron-desktop/.env.publish.local');
  process.exit(1);
}

if (!tags.length) {
  console.error('Usage: node delete-github-releases.js v3.3.1 v3.3.2');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function api(method, apiPath) {
  const res = await fetch(`https://api.github.com${apiPath}`, { method, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${apiPath} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function main() {
  for (const tag of tags) {
    try {
      const release = await api('GET', `/repos/${owner}/${repo}/releases/tags/${tag}`);
      await api('DELETE', `/repos/${owner}/${repo}/releases/${release.id}`);
      console.log(`Deleted release ${tag} (id ${release.id})`);
    } catch (err) {
      if (String(err.message).includes('404')) {
        console.log(`Release ${tag} not found — skipped`);
        continue;
      }
      throw err;
    }
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
