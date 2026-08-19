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
vm.runInContext(fs.readFileSync(path.join(root, 'src', 'scripts', 'purchases.js'), 'utf8'), context);

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
  ['url', 'modo', 'colabAtivoId', 'ultimaMudancaLocal', 'syncPendente', 'ultimoSyncConfirmado', 'relogioServidorOffset', 'backendComControleRevisao']
    .forEach(campo => assert.equal(Object.hasOwn(payload.configs, campo), false));
});

test('preferencia de agrupar compras por status persiste e acompanha a nuvem', () => {
  const local = {
    app_id: 'alofeira', syncRevision: 4,
    configs: { url: 'local', modo: 'compras', agruparComprasPorStatus: false, atualizadoEm: 100, syncPendente: false }
  };
  const remoto = {
    app_id: 'alofeira', syncRevision: 5,
    configs: { agruparComprasPorStatus: true, atualizadoEm: 500 }
  };
  const resultado = executar('aplicarNuvemNaInicializacao(entradaTeste.local, entradaTeste.remoto)', { local, remoto });
  assert.equal(resultado.banco.configs.agruparComprasPorStatus, true);
  assert.equal(resultado.banco.configs.url, 'local');

  const payload = executar('db = entradaTeste; prepararBancoParaNuvem()', resultado.banco);
  assert.equal(payload.configs.agruparComprasPorStatus, true);
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

test('preferencias de relatorio do fornecedor acompanham a sincronizacao', () => {
  const local = {
    app_id:'alofeira', syncRevision:3,
    fornecedores:[{ id:'f_1', nome:'Fornecedor', atualizadoEm:100 }],
    configs:{ url:'local', syncPendente:false }
  };
  const remoto = {
    app_id:'alofeira', syncRevision:4,
    fornecedores:[{
      id:'f_1', nome:'Fornecedor', atualizadoEm:500,
      preferenciasRelatorio:{ cabecalho:false, agruparCategorias:true, cotacao:false, pedido:true, mostrarQuantidade:false }
    }],
    configs:{}
  };
  const resultado = executar('mesclarBancos(entradaTeste.local, entradaTeste.remoto)', { local, remoto });
  assert.equal(resultado.banco.fornecedores[0].preferenciasRelatorio.pedido, true);
  assert.equal(resultado.banco.fornecedores[0].preferenciasRelatorio.cabecalho, false);
  assert.equal(resultado.banco.fornecedores[0].preferenciasRelatorio.mostrarQuantidade, false);
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

test('abertura troca lista antiga pela nuvem e preserva somente rascunhos locais', () => {
  const local = {
    app_id: 'alofeira', syncRevision: 1,
    pedidosAtivos: [
      { idUnico:'pa_antigo', produtoId:'p_1', status:'pendente', dataStatus:900 },
      { idUnico:'pa_rascunho', produtoId:'p_2', status:'rascunho', dataStatus:950 }
    ],
    colaboradores: [{ id:'col_1', nome:'Lincoln', emoji:'👤', atualizadoEm:100 }],
    configs: { url:'local', modo:'pedido', colabAtivoId:'col_1', syncPendente:false }
  };
  const remoto = {
    app_id: 'alofeira', syncRevision: 8,
    pedidosAtivos: [{ idUnico:'pa_atual', produtoId:'p_1', status:'comprado', dataStatus:500 }],
    colaboradores: [{ id:'col_1', nome:'Lincoln', emoji:'🧑‍🍳', atualizadoEm:500 }],
    configs: { exigirColaborador:true, atualizadoEm:500 }
  };
  const resultado = executar('aplicarNuvemNaInicializacao(entradaTeste.local, entradaTeste.remoto)', { local, remoto });
  assert.deepEqual(Array.from(resultado.banco.pedidosAtivos, item => item.idUnico).sort(), ['pa_atual', 'pa_rascunho']);
  assert.equal(resultado.banco.colaboradores[0].emoji, '🧑‍🍳');
  assert.equal(resultado.banco.configs.url, 'local');
  assert.equal(resultado.banco.configs.colabAtivoId, 'col_1');
  assert.equal(resultado.banco.syncRevision, 8);
  assert.equal(resultado.precisaEnviar, false);
});

test('abertura reconcilia alteracoes realmente pendentes antes de enviar', () => {
  const local = {
    app_id:'alofeira', syncRevision:2,
    colaboradores:[{ id:'col_1', nome:'Lincoln', emoji:'👨‍🍳', atualizadoEm:800 }],
    configs:{ url:'local', modo:'compras', colabAtivoId:'col_1', syncPendente:true }
  };
  const remoto = {
    app_id:'alofeira', syncRevision:3,
    colaboradores:[{ id:'col_1', nome:'Lincoln', emoji:'👤', atualizadoEm:400 }],
    configs:{}
  };
  const resultado = executar('aplicarNuvemNaInicializacao(entradaTeste.local, entradaTeste.remoto)', { local, remoto });
  assert.equal(resultado.banco.colaboradores[0].emoji, '👨‍🍳');
  assert.equal(resultado.precisaEnviar, true);
});

test('emoji enviado por um aparelho aparece na abertura de outro', () => {
  const nuvem = {
    app_id:'alofeira', syncRevision:12,
    colaboradores:[{ id:'col_1', nome:'Lincoln', emoji:'🧑‍💼', atualizadoEm:1200 }],
    configs:{}
  };
  const aparelhoAntigo = {
    app_id:'alofeira', syncRevision:4,
    colaboradores:[{ id:'col_1', nome:'Lincoln', emoji:'👤', atualizadoEm:100 }],
    configs:{ url:'local', modo:'pedido', colabAtivoId:'col_1', syncPendente:false }
  };
  const resultado = executar('aplicarNuvemNaInicializacao(entradaTeste.local, entradaTeste.remoto)', { local:aparelhoAntigo, remoto:nuvem });
  assert.equal(resultado.banco.colaboradores[0].emoji, '🧑‍💼');
});

test('preco com fornecedor vincula o local ao cadastro do produto sem duplicar', () => {
  const produto = { id:'p_1', fornecedores:['f_1'] };
  const primeira = executar('vincularFornecedorPossivel(entradaTeste.produto, entradaTeste.fornecedorId)', { produto, fornecedorId:'f_2' });
  const repetida = executar('vincularFornecedorPossivel(entradaTeste.produto, entradaTeste.fornecedorId)', { produto, fornecedorId:'f_2' });
  assert.equal(primeira, true);
  assert.equal(repetida, false);
  assert.deepEqual(produto.fornecedores, ['f_1', 'f_2']);
});

test('sincronizacao de abertura busca a nuvem mesmo com rascunho antigo', async () => {
  const remoto = {
    app_id:'alofeira', syncRevision:9, serverNow:5000,
    pedidosAtivos:[{ idUnico:'pa_nuvem', produtoId:'p_1', status:'pendente', dataStatus:4000 }],
    colaboradores:[{ id:'col_1', nome:'Lincoln', emoji:'🧑‍🍳', atualizadoEm:4000 }],
    configs:{}
  };
  context.fetch = async () => ({ ok:true, async text() { return JSON.stringify(remoto); } });
  executar('db = normalizarBanco(entradaTeste)', {
    app_id:'alofeira', syncRevision:1,
    pedidosAtivos:[{ idUnico:'pa_rascunho', produtoId:'p_1', status:'rascunho', dataStatus:100 }],
    colaboradores:[{ id:'col_1', nome:'Lincoln', emoji:'👤', atualizadoEm:100 }],
    configs:{ url:'https://backend.test', modo:'pedido', colabAtivoId:'col_1', syncPendente:false }
  });
  assert.equal(await vm.runInContext('sincronizarInicializacao()', context), true);
  const estado = vm.runInContext('JSON.parse(JSON.stringify(db))', context);
  assert.deepEqual(Array.from(estado.pedidosAtivos, item => item.idUnico).sort(), ['pa_nuvem', 'pa_rascunho']);
  assert.equal(estado.colaboradores[0].emoji, '🧑‍🍳');
  assert.equal(estado.configs.backendComControleRevisao, true);
});

test('falha ao consultar a nuvem nao transforma banco antigo em alteracao pendente', async () => {
  const consoleOriginal = context.console;
  context.console = Object.assign({}, console, { error() {} });
  context.fetch = async () => { throw new Error('offline'); };
  executar('db = normalizarBanco(entradaTeste)', {
    app_id:'alofeira', pedidosAtivos:[],
    configs:{ url:'https://backend.test', modo:'pedido', syncPendente:false }
  });
  assert.equal(await vm.runInContext('sincronizarInicializacao()', context), false);
  assert.equal(vm.runInContext('db.configs.syncPendente', context), false);
  context.console = consoleOriginal;
});

test('backend legado e conferido antes de qualquer gravacao completa', async () => {
  const metodos = [];
  let payloadEnviado = null;
  const remoto = {
    app_id:'alofeira', syncRevision:0,
    pedidosAtivos:[{ idUnico:'pa_remoto', produtoId:'p_1', status:'pendente', dataStatus:200 }],
    configs:{}
  };
  context.fetch = async (_url, options = {}) => {
    const metodo = options.method || 'GET';
    metodos.push(metodo);
    if(metodo === 'POST') {
      payloadEnviado = JSON.parse(options.body);
      return { ok:true, async text() { return JSON.stringify({ status:'sucesso' }); } };
    }
    return { ok:true, async text() { return JSON.stringify(remoto); } };
  };
  executar('db = normalizarBanco(entradaTeste)', {
    app_id:'alofeira', syncRevision:0,
    pedidosAtivos:[{ idUnico:'pa_local', produtoId:'p_1', status:'pendente', dataStatus:300 }],
    configs:{ url:'https://backend-legado.test', modo:'compras', syncPendente:true, backendComControleRevisao:false }
  });
  await vm.runInContext('postarBanco()', context);
  assert.deepEqual(metodos, ['GET', 'POST']);
  assert.deepEqual(payloadEnviado.dados.pedidosAtivos.map(item => item.idUnico).sort(), ['pa_local', 'pa_remoto']);
});
