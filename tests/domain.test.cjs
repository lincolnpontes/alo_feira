const test = require('node:test');
const assert = require('node:assert/strict');
const domain = require('../src/scripts/domain.js');

test('aceita somente confirmacao explicita do backend', () => {
  assert.equal(domain.validarRespostaServidor({ status: 'sucesso', revision: 3 }).ok, true);
  assert.deepEqual(domain.validarRespostaServidor({ status: 'erro', msg: 'falhou' }), {
    ok: false,
    conflito: false,
    mensagem: 'falhou'
  });
  assert.equal(domain.validarRespostaServidor({ status: 'conflito' }).conflito, true);
});

test('mescla pedidos pela alteracao mais recente e respeita a exclusao global', () => {
  const remotos = [
    { idUnico: 'pa_1', status: 'pendente', dataStatus: 100 },
    { idUnico: 'pa_antigo', status: 'entregue', dataStatus: 20 },
    { idUnico: 'rascunho_remoto', status: 'rascunho', dataStatus: 200 }
  ];
  const locais = [
    { idUnico: 'pa_1', status: 'pedido_forn', dataStatus: 150 },
    { idUnico: 'rascunho_local', status: 'rascunho', dataStatus: 220 }
  ];

  const resultado = domain.mesclarPedidos(locais, remotos, 50);
  assert.equal(resultado.find(p => p.idUnico === 'pa_1').status, 'pedido_forn');
  assert.equal(resultado.some(p => p.idUnico === 'pa_antigo'), false);
  assert.equal(resultado.some(p => p.idUnico === 'rascunho_remoto'), false);
  assert.equal(resultado.some(p => p.idUnico === 'rascunho_local'), true);
});

test('propaga a limpeza quando ela possui data de alteracao mais nova', () => {
  const remoto = [{ idUnico: 'pa_1', status: 'entregue', ocultoCompras: false, dataStatus: 100 }];
  const local = [{ idUnico: 'pa_1', status: 'entregue', ocultoCompras: true, dataStatus: 200 }];
  const resultado = domain.mesclarPedidos(local, remoto);
  assert.equal(resultado[0].ocultoCompras, true);
  assert.equal(resultado[0].dataStatus, 200);
});

test('mescla historicos de precos e respeita exclusoes sincronizadas', () => {
  const remoto = [{ id: 'preco_a', data: '2026-08-15', preco: 10, fornecedorId: 'f_1', atualizadoEm: 100 }];
  const local = [{ id: 'preco_b', data: '2026-08-16', preco: 12, fornecedorId: 'f_2', atualizadoEm: 200 }];
  const mesclado = domain.mesclarHistoricosPrecos(local, remoto, {}, 200, 100);
  assert.deepEqual(mesclado.map(item => item.id), ['preco_a', 'preco_b']);

  const aposExclusao = domain.mesclarHistoricosPrecos(local, remoto, { preco_a: 300 }, 200, 100);
  assert.deepEqual(aposExclusao.map(item => item.id), ['preco_b']);
});

test('registra a data indicada para pedido ao fornecedor e preserva no recebimento', () => {
  const pedido = { status: 'pendente', dataStatus: 10 };
  assert.equal(domain.aplicarTransicao(pedido, 'pedido_forn', 1000).ok, true);
  assert.equal(pedido.dataPedidoFornecedor, 1000);
  assert.equal(domain.aplicarTransicao(pedido, 'entregue', 2000).ok, true);
  assert.equal(pedido.dataPedidoFornecedor, 1000);
  assert.equal(pedido.dataConclusao, 2000);
});

test('perfil de recebimento so conclui itens pedidos ao fornecedor', () => {
  const pendente = { status: 'pendente' };
  assert.equal(domain.aplicarTransicao(pendente, 'pedido_forn', 1000, true).ok, false);
  assert.equal(domain.aplicarTransicao(pendente, 'comprado', 1000, true).ok, false);

  const pedido = { status: 'pedido_forn', dataPedidoFornecedor: 500 };
  assert.equal(domain.aplicarTransicao(pedido, 'entregue', 1000, true).ok, true);
  assert.equal(pedido.dataPedidoFornecedor, 500);
});
