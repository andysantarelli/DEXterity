const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { createProviders } = require('./lib/providers');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const { referenceService } = createProviders();

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const type = MIME_TYPES[ext] || 'text/plain; charset=utf-8';
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: 'File not found.' });
      return;
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  });
}

async function collectBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function handlePokemonLookup(reqUrl, res) {
  const query = reqUrl.searchParams.get('q');
  if (!query) {
    sendJson(res, 400, { error: 'A Pokemon name or Pokedex number is required.' });
    return;
  }
  try {
    sendJson(res, 200, await referenceService.lookupPokemon(query));
  } catch (error) {
    sendJson(res, 500, {
      error: 'Unable to load Pokemon data right now.',
      details: error.message,
    });
  }
}

async function handleDamageCalc(req, res) {
  try {
    const body = JSON.parse(await collectBody(req));
    sendJson(res, 200, referenceService.calculateDamage(body.attacker, body.defender, body.move, body.options || {}));
  } catch (error) {
    sendJson(res, 400, {
      error: 'Unable to calculate damage with the current inputs.',
      details: error.message,
    });
  }
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && reqUrl.pathname === '/api/pokemon') {
    await handlePokemonLookup(reqUrl, res);
    return;
  }

  if (req.method === 'POST' && reqUrl.pathname === '/api/calc') {
    await handleDamageCalc(req, res);
    return;
  }

  const relativePath = reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, relativePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  sendFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`VGC reference app running at http://localhost:${PORT}`);
});
