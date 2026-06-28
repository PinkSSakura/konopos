const os = require('os');

/** Adapters that are not reachable from phones/tablets on Wi‑Fi. */
const VIRTUAL_ADAPTER = /virtual|vmware|hyper-v|vethernet|wsl|docker|vpn|loopback|tap|tun|bluetooth|npcap|hamachi|tailscale|zerotier/i;

function scoreAdapter(name, address) {
  let score = 0;
  if (/wi-?fi|wlan|wireless/i.test(name)) score += 100;
  if (/ethernet|eth/i.test(name) && !/virtual/i.test(name)) score += 80;
  if (address.startsWith('192.168.')) score += 50;
  if (address.startsWith('10.')) score += 40;
  if (address.startsWith('172.')) {
    const second = Number(address.split('.')[1]);
    if (second >= 16 && second <= 31) score += 5;
  }
  return score;
}

function getLocalIPv4() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const [name, ifaces] of Object.entries(nets)) {
    if (VIRTUAL_ADAPTER.test(name)) continue;

    ifaces?.forEach((iface) => {
      const family = iface.family;
      if (family !== 'IPv4' && family !== 4) return;
      if (iface.internal) return;

      const address = iface.address;
      if (!address || address.startsWith('169.254.')) return;

      candidates.push({
        name,
        address,
        score: scoreAdapter(name, address),
      });
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const seen = new Set();
  const ordered = [];
  for (const c of candidates) {
    if (seen.has(c.address)) continue;
    seen.add(c.address);
    ordered.push(c.address);
  }
  return ordered;
}

function getPrimaryLanIPv4() {
  return getLocalIPv4()[0] || null;
}

module.exports = { getLocalIPv4, getPrimaryLanIPv4 };
