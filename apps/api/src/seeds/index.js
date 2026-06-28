require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const connectDB = require('../db/connect');
const { ensureBootstrapData } = require('./bootstrap');

async function seed() {
  await connectDB();
  console.log('Seed : bootstrap rôles, permissions, superadmin…');
  await ensureBootstrapData();

  console.log('Seed terminé.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
