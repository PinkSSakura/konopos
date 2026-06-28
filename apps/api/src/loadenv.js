const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPath = process.env.KONOPOS_ENV_FILE
  || path.join(__dirname, '../.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

module.exports = envPath;
