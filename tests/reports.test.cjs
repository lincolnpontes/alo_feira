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
  relatTexto: { value: 'Relatorio', select() {} }
};
let aberturasWhatsApp = 0;
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
