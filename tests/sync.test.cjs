const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const domain = require('../src/scripts/domain.js');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  AloFeiraDomain: domain,
  localStorage: { getItem() { return null; }, setItem() {} },
  document: { addEventListener() {}, getElementById() { return null; } },
  window: { addEventListener() {}, location: {} },
  navigator: { onLine: true },
  setInterval() { return 0; },
  setTimeout() { return 0; },
  clearTimeout() {},
  AbortController,
  fetch,
  console
});

vm.runInContext(fs.readFileSync(path.join(root, 'src', 'scripts', 'core.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'src', 'scripts', 'sync.js'), 'utf8'), context);

function executar(expressao, entrada) {
  context.entradaTeste = entrada;
  return vm.runInContext(expressao, context);
}

test('payload compartilha dados operacionais e preserva estado local do aparelho', () => {
  const entrada = {
    app_id: 'alofeira',
    syncRevision: 4,
    colaboradores: [{ id: 'col_1', nome: 'Lincoln', emoji: '🧑‍🍳', atualizadoEm: 200 }],
    pedidosAtivos: [
      { idUnico: 'pa_1', produtoId: 'p_1', status: 'entregue', ocultoCompras: true, dataStatus: 300 },
      { idUnico: 'pa_rascunho', produtoId: 'p_1', status: 'rascunho', dataStatus: 400 }
    ],
    configs: {
      exigirColaborador: false,
      atualizadoEm: 250,
      url: 'local', modo: 'compras', colabAtivoId: 'col_1', ultimaMudancaLocal: 999,
      syncPendente: true, ultimoSyncConfirmado: 900, relogioServidorOffset: 10
    }
  };
  const payload = executar('db = normalizarBanco(entradaTeste); prepararBancoParaNuvem()', entrada);
  assert.equal(payload.colaboradores[0].emoji, '🧑‍🍳');
  assert.equal(payload.pedidosAtivos[0].ocultoCompras, true);
  assert.equal(payload.pedidosAtivos.some(p => p.status === 'rascunho'), false);
  assert.equal(payload.configs.exigirColaborador, false);
  assert.equal(payload.configs.atualizadoEm, 250);
  ['url', 'modo', 'colabAtivoId', 'ultimaMudancaLocal', 'syncPendente', 'ultimoSyncConfirmado', 'relogioServidorOffset']
    .forEach(campo => assert.equal(Object.hasOwn(payload.configs, campo), false));
});

test('mesclagem traz emoji, conserva configuracao mais nova e respeita ordem das categorias', () => {
  const local = {
    app_id: 'alofeira', syncRevision: 4,
    colaboradores: [{ id: 'col_1', nome: 'Lincoln', emoji: '🧑‍🍳', atualizadoEm: 300 }],
    categorias: [
      { id: 'c_2', nome: 'Dois', ordem: 0, atualizadoEm: 300 },
      { id: 'c_1', nome: 'Um', ordem: 1, atualizadoEm: 300 }
    ],
    configs: { exigirColaborador: false, atualizadoEm: 300, url: 'local', modo: 'compras', colabAtivoId: 'col_1', syncPendente: true }
  };
  const remoto = {
    app_id: 'alofeira', syncRevision: 5,
    colaboradores: [{ id: 'col_1', nome: 'Lincoln', emoji: '👤', atualizadoEm: 100 }],
    categorias: [
      { id: 'c_1', nome: 'Um', ordem: 0, atualizadoEm: 100 },
      { id: 'c_2', nome: 'Dois', ordem: 1, atualizadoEm: 100 }
    ],
    configs: { exigirColaborador: true, atualizadoEm: 100 }
  };
  const resultado = executar('mesclarBancos(entradaTeste.local, entradaTeste.remoto)', { local, remoto });
  assert.equal(resultado.banco.colaboradores[0].emoji, '🧑‍🍳');
  assert.deepEqual(Array.from(resultado.banco.categorias, c => c.id), ['c_2', 'c_1']);
  assert.equal(resultado.banco.configs.exigirColaborador, false);
  assert.equal(resultado.banco.configs.url, 'local');
  assert.equal(resultado.banco.configs.modo, 'compras');
  assert.equal(resultado.precisaEnviar, true);
});
