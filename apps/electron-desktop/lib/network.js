const path = require('path');
const { getProjectRoot } = require('./projectRoot');

function loadLanUtils() {
  try {
    const { lan } = require(path.join(getProjectRoot(), 'apps', 'api', 'src', 'utils'))();
    return lan;
  } catch {
    return null;
  }
}

function getLocalIPv4() {
  const utils = loadLanUtils();
  if (utils) return utils.getLocalIPv4();

  const os = require('os');
  const nets = os.networkInterfaces();
  const addresses = [];
  Object.values(nets).forEach((ifaces) => {
    ifaces?.forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address?.startsWith('169.254.')) {
        addresses.push(iface.address);
      }
    });
  });
  return addresses;
}

function getPrimaryLanIPv4() {
  const list = getLocalIPv4();
  return list[0] || null;
}

module.exports = { getLocalIPv4, getPrimaryLanIPv4 };
