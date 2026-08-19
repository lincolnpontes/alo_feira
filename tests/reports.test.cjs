const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const botaoWhatsApp = { disabled: false, dataset: {}, title: '' };
const campos = {
  btnEnviarWhatsAppRelatorio: botaoWhatsApp,
  relatFornecedor: { value: '' },
  relatTexto: { value: 'Relatorio', select() {} },
  relatToggleCab: { checked: true },
  relatToggleCat: { checked: true },
  relatToggleItens: { checked: true },
  relatTogglePedido: { checked: false },
  relatToggleQtd: { checked: true }
};
let aberturasWhatsApp = 0;
let mudancasEstruturais = 0;
let sincronizacoes = 0;
const context = vm.createContext({
  db: {
    fornecedores: [],
    produtos: [
      { id: 'p_1', nome: 'Arroz', fornecedores: ['f_1'] },
      { id: 'p_2', nome: 'Feijao', fornecedores: [] }
    ],
    pedidosAtivos: [
      { idUnico: 'pa_1', produtoId: 'p_1' },
      { idUnico: 'pa_2', produtoId: 'p_2' }
    ]
  },
  document: {
    getElementById(id) { return campos[id]; },
    execCommand() {}
  },
  window: { open() { aberturasWhatsApp++; } },
  marcarMudancaEstrutural(fornecedor) { fornecedor.atualizadoEm = 1000; mudancasEstruturais++; },
  sincronizarFundo() { sincronizacoes++; },
  alert() {},
  encodeURIComponent
});

vm.runInContext(fs.readFileSync(path.join(root, 'src', 'scripts', 'reports.js'), 'utf8'), context);

test('relatorio inclui itens selecionados mesmo sem vinculo com fornecedor', () => {
  const nomes = vm.runInContext("obterItensProcessadosRelatorio(['pa_1', 'pa_2']).map(item => item.p.nome).join(',')", context);
  assert.equal(nomes, 'Arroz,Feijao');
});

test('whatsapp permanece bloqueado sem fornecedor selecionado', () => {
  vm.runInContext('atualizarEnvioWhatsAppRelatorio(null)', context);
  assert.equal(botaoWhatsApp.disabled, true);
  assert.equal(botaoWhatsApp.title, 'Selecione um fornecedor');

  vm.runInContext('enviarWhatsAppAPI()', context);
  assert.equal(aberturasWhatsApp, 0);
});

test('whatsapp e liberado quando existe fornecedor selecionado', () => {
  const fornecedor = { id: 'f_1', nome: 'Fornecedor', telefone: '83999999999' };
  context.db.fornecedores = [fornecedor];
  campos.relatFornecedor.value = fornecedor.id;
  context.fornecedorTeste = fornecedor;
  vm.runInContext('atualizarEnvioWhatsAppRelatorio(fornecedorTeste)', context);
  assert.equal(botaoWhatsApp.disabled, false);
});

test('cada fornecedor recupera a ultima configuracao enviada', () => {
  const fornecedor = {
    id: 'f_2',
    nome: 'Outro fornecedor',
    preferenciasRelatorio: {
      cabecalho: false,
      agruparCategorias: false,
      cotacao: false,
      pedido: true,
      mostrarQuantidade: false
    }
  };
  context.fornecedorTeste = fornecedor;
  vm.runInContext('aplicarPreferenciasRelatorio(fornecedorTeste)', context);
  assert.equal(campos.relatToggleCab.checked, false);
  assert.equal(campos.relatToggleCat.checked, false);
  assert.equal(campos.relatToggleItens.checked, false);
  assert.equal(campos.relatTogglePedido.checked, true);
  assert.equal(campos.relatToggleQtd.checked, false);

  campos.relatToggleCab.checked = true;
  campos.relatToggleQtd.checked = true;
  vm.runInContext('registrarPreferenciasRelatorioEnviadas(fornecedorTeste)', context);
  assert.equal(fornecedor.preferenciasRelatorio.cabecalho, true);
  assert.equal(fornecedor.preferenciasRelatorio.mostrarQuantidade, true);
  assert.equal(mudancasEstruturais, 1);
  assert.equal(sincronizacoes, 1);
});
