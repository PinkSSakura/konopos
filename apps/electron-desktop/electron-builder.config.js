const { GITHUB_OWNER, GITHUB_REPO } = require('./lib/updateConfig');
const pkg = require('./package.json');

/** @type {import('electron-builder').Configuration} */
module.exports = {
  ...pkg.build,
  publish: [
    {
      provider: 'github',
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      private: false,
      releaseType: 'release',
    },
  ],
};
