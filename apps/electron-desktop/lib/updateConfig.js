/**
 * GitHub Releases feed for in-app updates (public repo).
 * Build/publish env:
 *   TouDev_GH_OWNER=PinkSSakura
 *   TouDev_GH_REPO=TouDev
 *   GH_TOKEN=...  (Contents write — publish from your machine only)
 */
const GITHUB_OWNER = process.env.TouDev_GH_OWNER || process.env.KONOPOS_GH_OWNER || 'PinkSSakura';
const GITHUB_REPO = process.env.TouDev_GH_REPO || process.env.KONOPOS_GH_REPO || 'konopos';
const GITHUB_PRIVATE = false;

let GITHUB_UPDATE_TOKEN = '';
try {
  GITHUB_UPDATE_TOKEN = require('./updateToken.built').token || '';
} catch {
  GITHUB_UPDATE_TOKEN = process.env.TouDev_GH_UPDATE_TOKEN || '';
}

module.exports = {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_PRIVATE,
  GITHUB_UPDATE_TOKEN,
};
