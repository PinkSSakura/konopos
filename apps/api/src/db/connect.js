const config = require('../config');
const syncPaymentIndexes = require('./sync-indexes');
const { connectSQLite, getDatabasePath } = require('./sqlite');

async function connectDB() {
  connectSQLite();
  console.log(`SQLite connecté : ${config.sqlitePath || getDatabasePath()}`);
  await syncPaymentIndexes();
}

module.exports = connectDB;
