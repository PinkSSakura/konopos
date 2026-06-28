const fs = require('fs');
const path = require('path');
const { loadPublishEnv } = require('./load-publish-env');

loadPublishEnv();

const token = process.env.TouDev_GH_UPDATE_TOKEN || process.env.GH_TOKEN || '';
const outPath = path.join(__dirname, '..', 'lib', 'updateToken.built.js');

const contents = `// Generated at build time — do not commit (gitignored).
module.exports = {
  token: ${JSON.stringify(token)},
};
`;

fs.writeFileSync(outPath, contents, 'utf8');

if (!token) {
  console.warn(
    '[TouDev] TouDev_GH_UPDATE_TOKEN not set — private GitHub updates will not download until you rebuild with a read token.',
  );
} else {
  console.log('[TouDev] Update token embedded for GitHub releases.');
}
