/**
 * GitHub Releases feed for in-app updates (public repo).
 * Build/publish env:
 *   KONOPOS_GH_OWNER=PinkSSakura
 *   KONOPOS_GH_REPO=konopos
 *   GH_TOKEN=...  (Contents write — publish from your machine only)
 */
const GITHUB_OWNER = process.env.KONOPOS_GH_OWNER || 'PinkSSakura';
const GITHUB_REPO = process.env.KONOPOS_GH_REPO || 'konopos';
const GITHUB_PRIVATE = false;

let GITHUB_UPDATE_TOKEN = '';
try {
  GITHUB_UPDATE_TOKEN = require('./updateToken.built').token || '';
} catch {
  GITHUB_UPDATE_TOKEN = process.env.KONOPOS_GH_UPDATE_TOKEN || '';
}

module.exports = {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_PRIVATE,
  GITHUB_UPDATE_TOKEN,
};
