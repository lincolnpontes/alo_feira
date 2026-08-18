const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'backend', 'Code.gs'), 'utf8');
const context = {
  ContentService: {
    MimeType: { JSON: 'json', TEXT: 'text' },
    createTextOutput(text) {
      return { text, setMimeType() { return this; } };
    }
  },
  SpreadsheetApp: { flush() {} },
  console
};
vm.runInNewContext(source, context, { filename: 'Code.gs' });

test('backend preserva historico e usa hora do servidor em alteracoes', () => {
  const atual = {
    pedidosAtivos: [{ idUnico: 'pa_1', status: 'pendente', qtd: 1, dataStatus: 100, dataEnvio: 90 }],
    produtos: [], categorias: [], fornecedores: [], colaboradores: [], restaurante: {}
  };
  const novo = {
    pedidosAtivos: [
      { idUnico: 'pa_1', status: 'pedido_forn', qtd: 1, dataStatus: 200, dataEnvio: 90, dataPedidoFornecedor: 200 },
      { idUnico: 'pa_historico', status: 'entregue', qtd: 2, dataStatus: 50, dataEnvio: 30, dataConclusao: 50 }
    ],
    produtos: [], categorias: [], fornecedores: [], colaboradores: [], restaurante: {}
  };

  const resultado = context.aplicarTemposServidor_(atual, novo, 5000, false);
  assert.equal(novo.pedidosAtivos[0].dataStatus, 5000);
  assert.equal(novo.pedidosAtivos[0].dataPedidoFornecedor, 5000);
  assert.equal(novo.pedidosAtivos[1].dataConclusao, 50);
  assert.equal(resultado.pedidosAtualizados.length, 1);
});

test('backend confirma configuracoes compartilhadas com hora do servidor', () => {
  const atual = {
    pedidosAtivos: [], produtos: [], categorias: [], fornecedores: [], colaboradores: [], restaurante: {},
    configs: { exigirColaborador: true, atualizadoEm: 100 }
  };
  const novo = {
    pedidosAtivos: [], produtos: [], categorias: [], fornecedores: [], colaboradores: [], restaurante: {},
    configs: { exigirColaborador: false, atualizadoEm: 200 }
  };
  const resultado = context.aplicarTemposServidor_(atual, novo, 5000, false);
  assert.equal(novo.configs.atualizadoEm, 5000);
  assert.equal(resultado.configAtualizadoEm, 5000);
});

test('envio leve e idempotente acrescenta pedidos sem remover os existentes', () => {
  let partesGravadas = [];
  const aba = {
    clearContents() {},
    getRange() { return { setValues(valores) { partesGravadas = valores; } }; }
  };
  const atual = {
    app_id: 'alofeira', schemaVersion: 2, syncRevision: 3,
    pedidosAtivos: [{ idUnico: 'pa_antigo', produtoId: 'p_1', status: 'entregue', dataStatus: 100 }],
    produtos: [{ id: 'p_1', nome: 'Produto existente', atualizadoEm: 100 }]
  };
  const payload = {
    pedidos: [{ idUnico: 'pa_novo', produtoId: 'p_avulso', status: 'rascunho', dataStatus: 200 }],
    produtos: [{ id: 'p_avulso', nome: 'Item avulso', avulso: true, atualizadoEm: 200 }]
  };

  const resposta = JSON.parse(context.enviarPedidos_(aba, atual, payload, 3, 9000).text);
  const gravado = JSON.parse(partesGravadas.map(linha => linha[0]).join(''));
  assert.equal(resposta.status, 'sucesso');
  assert.equal(resposta.revision, 4);
  assert.equal(gravado.pedidosAtivos.length, 2);
  assert.equal(gravado.pedidosAtivos[0].idUnico, 'pa_antigo');
  assert.equal(gravado.pedidosAtivos[1].status, 'pendente');
  assert.equal(gravado.pedidosAtivos[1].dataEnvio, 9000);
  assert.equal(gravado.produtos.length, 2);
  assert.equal(gravado.produtos[1].nome, 'Item avulso');
  assert.equal(gravado.produtos[1].atualizadoEm, 9000);

  partesGravadas = [];
  const repetida = JSON.parse(context.enviarPedidos_(aba, atual, payload, 4, 9100).text);
  assert.equal(repetida.revision, 4);
  assert.equal(atual.pedidosAtivos.length, 2);
  assert.equal(atual.produtos.length, 2);
  assert.equal(partesGravadas.length, 0);
});
