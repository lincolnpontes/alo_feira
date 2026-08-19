const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
let agora = 6000;
let esperaAgendada = null;
const context = vm.createContext({
  agoraServidor() { return agora; },
  timerReagruparCompras: null,
  agrupamentoCompradoAtivo: true,
  db: {
    configs: { modo: 'compras' },
    pedidosAtivos: [{ idUnico:'pa_1', status:'pedido_forn', statusAnterior:'pendente', transicaoProgresso:1000 }]
  },
  setTimeout(_acao, espera) { esperaAgendada = espera; return 1; },
  clearTimeout() {}
});

vm.runInContext(fs.readFileSync(path.join(root, 'src', 'scripts', 'catalog.js'), 'utf8'), context);

test('item permanece no grupo anterior durante dez segundos', () => {
  const antes = vm.runInContext("statusEfetivoNoAgrupamento(db.pedidosAtivos[0], 10999)", context);
  const depois = vm.runInContext("statusEfetivoNoAgrupamento(db.pedidosAtivos[0], 11000)", context);
  assert.equal(antes, 'pendente');
  assert.equal(depois, 'pedido_forn');
});

test('reagrupamento e agendado para o fim do intervalo restante', () => {
  vm.runInContext('agendarReagrupamentoCompras()', context);
  assert.equal(esperaAgendada, 5000);
});
