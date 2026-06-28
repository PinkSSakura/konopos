const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const distDir = process.env.WEB_DIST_DIR;
const port = Number(process.env.PORT) || 5173;
const apiHost = process.env.API_HOST || '127.0.0.1';
const apiPort = Number(process.env.API_PORT) || 5000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
};

function shouldProxy(url) {
  return url.startsWith('/api') || url.startsWith('/socket.io');
}

function normalizeProxyHeaders(headers) {
  const out = { ...headers };
  const rawCookies = out['set-cookie'];
  if (!rawCookies) return out;

  const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
  out['set-cookie'] = cookies.map((cookie) => cookie
    .replace(/;\s*Domain=[^;]*/gi, '')
    .replace(/;\s*Secure/gi, ''));
  return out;
}

function proxyHttp(req, res) {
  const proxyReq = http.request(
    {
      hostname: apiHost,
      port: apiPort,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${apiHost}:${apiPort}`,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, normalizeProxyHeaders(proxyRes.headers));
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxyReq);
}

function resolveStaticPath(urlPath) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(distDir, safePath);
  if (!filePath.startsWith(distDir)) {
    return null;
  }
  return filePath;
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  const filePath = resolveStaticPath(urlPath.slice(1));
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      const indexPath = path.join(distDir, 'index.html');
      fs.readFile(indexPath, (readErr, data) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function proxyUpgrade(req, clientSocket, head) {
  const proxySocket = net.connect(apiPort, apiHost, () => {
    const headerLines = [`${req.method} ${req.url} HTTP/1.1`];
    Object.entries(req.headers).forEach(([key, value]) => {
      headerLines.push(`${key}: ${value}`);
    });
    proxySocket.write(`${headerLines.join('\r\n')}\r\n\r\n`);
    if (head && head.length) {
      proxySocket.write(head);
    }
    clientSocket.pipe(proxySocket);
    proxySocket.pipe(clientSocket);
  });

  const destroy = () => {
    clientSocket.destroy();
    proxySocket.destroy();
  };

  proxySocket.on('error', destroy);
  clientSocket.on('error', destroy);
}

if (!distDir || !fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error(`Build web introuvable: ${distDir || '(non défini)'}`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (shouldProxy(req.url)) {
    proxyHttp(req, res);
    return;
  }
  serveStatic(req, res);
});

server.on('upgrade', (req, clientSocket, head) => {
  if (shouldProxy(req.url)) {
    proxyUpgrade(req, clientSocket, head);
    return;
  }
  clientSocket.destroy();
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Interface statique sur http://0.0.0.0:${port}`);
});
