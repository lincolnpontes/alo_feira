const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('todos os scripts do navegador possuem sintaxe valida', () => {
  const scripts = fs.readdirSync(path.join(root, 'src', 'scripts')).filter(name => name.endsWith('.js'));
  scripts.push('../../service-worker.js');
  for(const name of scripts) {
    const file = name.startsWith('../') ? path.resolve(root, 'src', 'scripts', name) : path.join(root, 'src', 'scripts', name);
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }));
  }
});

test('index referencia somente arquivos locais existentes', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const referencias = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map(match => match[1].split('?')[0])
    .filter(value => !value.startsWith('http') && value !== '');
  for(const referencia of referencias) {
    assert.equal(fs.existsSync(path.join(root, referencia)), true, `Arquivo ausente: ${referencia}`);
  }
  assert.equal(html.includes('relatColaborador'), false);
});

test('manifesto usa icones com as dimensoes declaradas', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.id, './');
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
  manifest.icons.forEach(icon => assert.equal(fs.existsSync(path.join(root, icon.src)), true));
});

test('compras mantem confirmacao dupla e gesto seguro de cancelamento', () => {
  const purchases = fs.readFileSync(path.join(root, 'src', 'scripts', 'purchases.js'), 'utf8');
  const catalog = fs.readFileSync(path.join(root, 'src', 'scripts', 'catalog.js'), 'utf8');
  assert.match(purchases, /Toque novamente para confirmar\./);
  assert.match(purchases, /diffX < -70\) abrirConfirmarCancelamento/);
  assert.match(catalog, /cliqueItemCompra[\s\S]*ontouchend="handleTouchEnd/);
});
