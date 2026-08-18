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
    restaurante: { nome:'Restaurante', atualizadoEm:180 },
    categorias: [{ id:'c_1', nome:'Secos', ordem:0, atualizadoEm:180 }],
    fornecedores: [{ id:'f_1', nome:'Fornecedor', atualizadoEm:180 }],
    produtos: [{ id:'p_1', nome:'Arroz', atualizadoEm:220, historicoPrecos:[{ id:'preco_1', data:'2026-08-17', preco:12.34, fornecedorId:'f_1', atualizadoEm:220 }] }],
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
  assert.equal(payload.restaurante.nome, 'Restaurante');
  assert.equal(payload.categorias[0].nome, 'Secos');
  assert.equal(payload.fornecedores[0].nome, 'Fornecedor');
  assert.equal(payload.produtos[0].historicoPrecos[0].preco, 12.34);
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

test('mesclagem preserva precos criados em aparelhos diferentes', () => {
  const local = {
    app_id: 'alofeira', syncRevision: 7,
    produtos: [{
      id: 'p_1', nome: 'Arroz', atualizadoEm: 200, fornecedores: ['f_2'],
      historicoPrecos: [{ id: 'preco_local', data: '2026-08-17', preco: 11, fornecedorId: 'f_2', atualizadoEm: 200 }]
    }],
    configs: { url: 'local', modo: 'compras', syncPendente: false }
  };
  const remoto = {
    app_id: 'alofeira', syncRevision: 8,
    produtos: [{
      id: 'p_1', nome: 'Arroz', atualizadoEm: 300, fornecedores: ['f_1'],
      historicoPrecos: [{ id: 'preco_remoto', data: '2026-08-16', preco: 10, fornecedorId: 'f_1', atualizadoEm: 100 }]
    }],
    configs: {}
  };
  const resultado = executar('mesclarBancos(entradaTeste.local, entradaTeste.remoto)', { local, remoto });
  const produto = resultado.banco.produtos[0];
  assert.deepEqual(Array.from(produto.historicoPrecos, item => item.id), ['preco_remoto', 'preco_local']);
  assert.deepEqual(Array.from(produto.fornecedores).sort(), ['f_1', 'f_2']);
  assert.equal(resultado.precisaEnviar, true);
});

test('mesclagem baixa limpeza da vassoura e emoji mais recentes', () => {
  const local = {
    app_id: 'alofeira', syncRevision: 2,
    pedidosAtivos: [{ idUnico: 'pa_1', produtoId: 'p_1', status: 'entregue', ocultoCompras: false, dataStatus: 100 }],
    colaboradores: [{ id: 'col_1', nome: 'Lincoln', emoji: '👤', atualizadoEm: 100 }],
    configs: { url: 'local', colabAtivoId: 'col_1' }
  };
  const remoto = {
    app_id: 'alofeira', syncRevision: 3,
    pedidosAtivos: [{ idUnico: 'pa_1', produtoId: 'p_1', status: 'entregue', ocultoCompras: true, dataStatus: 300 }],
    colaboradores: [{ id: 'col_1', nome: 'Lincoln', emoji: '🧑‍🍳', atualizadoEm: 300 }],
    configs: {}
  };
  const resultado = executar('mesclarBancos(entradaTeste.local, entradaTeste.remoto)', { local, remoto });
  assert.equal(resultado.banco.pedidosAtivos[0].ocultoCompras, true);
  assert.equal(resultado.banco.colaboradores[0].emoji, '🧑‍🍳');
});
