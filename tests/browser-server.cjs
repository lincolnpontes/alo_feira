const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2] || process.env.PORT || 5174);
let database = {
  app_id: 'alofeira',
  schemaVersion: 2,
  syncRevision: 0,
  restaurante: {},
  categorias: [],
  fornecedores: [],
  colaboradores: [],
  produtos: [],
  pedidosAtivos: [],
  configs: {}
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

function json(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  response.end(JSON.stringify(value));
}

function handleBackend(request, response) {
  if(request.method === 'GET') return json(response, 200, database);
  if(request.method !== 'POST') return json(response, 405, { status: 'erro', msg: 'Metodo invalido.' });
  let body = '';
  request.on('data', chunk => { body += chunk; });
  request.on('end', () => {
    try {
      const payload = JSON.parse(body);
      if(payload.action !== 'salvar_banco' || !payload.dados) throw new Error('Payload invalido.');
      if(!payload.force && Number(payload.baseRevision || 0) !== Number(database.syncRevision || 0)) {
        return json(response, 200, { status: 'conflito', revision: database.syncRevision, dados: database });
      }
      database = payload.dados;
      database.syncRevision = Number(database.syncRevision || 0) + 1;
      return json(response, 200, { status: 'sucesso', revision: database.syncRevision });
    } catch(error) {
      return json(response, 200, { status: 'erro', msg: error.message });
    }
  });
}

http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if(url.pathname === '/mock-backend') return handleBackend(request, response);
  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(root, relative);
  if(!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end('Not found');
  }
  response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Alô Feira browser test server: http://127.0.0.1:${port}`);
});
